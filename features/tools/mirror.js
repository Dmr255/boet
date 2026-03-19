import axios from 'axios';
import fs from 'fs';
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
    
    const type = contentType.split(';')[0].toLowerCase();
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
        // Pattern 1: filename*=UTF-8''encoded
        const match1 = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
        if (match1) {
            try {
                fileName = decodeURIComponent(match1[1].trim());
            } catch (e) {
                fileName = match1[1].trim();
            }
        }
        
        // Pattern 2: filename="value"
        if (!fileName) {
            const match2 = contentDisposition.match(/filename="([^"]+)"/i);
            if (match2) fileName = match2[1].trim();
        }
        
        // Pattern 3: filename=value (with no quotes)
        if (!fileName) {
            const match3 = contentDisposition.match(/filename=([^;,\n]+)/i);
            if (match3) fileName = match3[1].trim().replace(/['"]/g, '');
        }
    }

    // If we got a filename but no extension, try to add one from content-type
    if (fileName && !path.extname(fileName)) {
        const ext = getExtensionFromContentType(contentType);
        if (ext) fileName += ext;
    }
    
    // Fallback: if no filename, generate one with proper extension
    if (!fileName || fileName.length === 0) {
        const ext = getExtensionFromContentType(contentType) || '.bin';
        fileName = `${serviceName}_${Date.now()}${ext}`;
    }

    return fileName;
}

// ============================================================
// DOWNLOAD FROM GOFILE (using Pika Scraper bypass)
// ============================================================
async function downloadFromGofile(url) {
    try {
        // Extract gofile link ID
        const gofileMatch = url.match(/gofile\.io\/d\/([a-zA-Z0-9]+)/);
        if (!gofileMatch) {
            return { success: false, error: 'Invalid Gofile URL' };
        }

        // Use Pika Scraper bypass
        const scraperUrl = `https://pikascraper.pika.web.id/gofile?link=${encodeURIComponent(url)}`;
        const response = await axios.get(scraperUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'gofile_download';
        
        if (contentDisposition) {
            const match = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i) ||
                         contentDisposition.match(/filename="([^"]+)"/i) ||
                         contentDisposition.match(/filename=([^;,]+)/i);
            if (match) {
                fileName = match[1] ? decodeURIComponent(match[1].trim().replace(/['"]/g, '')) : fileName;
            }
        }

        // Add extension if missing
        if (!path.extname(fileName)) {
            const ext = getExtensionFromContentType(response.headers['content-type']) || '.bin';
            fileName += ext;
        }

        return {
            success: true,
            buffer: Buffer.from(response.data),
            fileName: fileName,
            size: response.data.length
        };
    } catch (err) {
        return { success: false, error: `Gofile: ${err.message}` };
    }
}

// ============================================================
// DOWNLOAD FROM PIXELDRAIN
// ============================================================
async function downloadFromPixeldrain(url) {
    try {
        // Extract file ID properly
        let fileId = url.split('/u/')[1] || url.split('/').pop();
        fileId = fileId.split('?')[0]; // Remove query params
        
        const apiUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const fileName = extractFileName(response.headers, 'pixeldrain');

        return {
            success: true,
            buffer: Buffer.from(response.data),
            fileName: fileName,
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
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://buzzheavier.com'
            },
            validateStatus: () => true,
            maxRedirects: 10
        });

        if (!response.data || response.data.length === 0) {
            return { success: false, error: 'Empty response from Buzzheavier' };
        }

        let fileName = 'buzzheavier_file';
        const contentDisposition = response.headers['content-disposition'];
        
        // Try to extract from content-disposition first
        if (contentDisposition) {
            const match = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i) ||
                         contentDisposition.match(/filename="([^"]+)"/i) ||
                         contentDisposition.match(/filename=([^;,]+)/i);
            if (match && match[1]) {
                fileName = decodeURIComponent(match[1].trim().replace(/["']/g, ''));
            }
        }
        
        // If still generic, try to extract from response content or metadata
        // Buzzheavier doesn't always provide filename, so generate meaningful one
        if (fileName === 'buzzheavier_file' || fileName.length < 5) {
            const timestamp = Date.now();
            fileName = `buzzheavier_${timestamp}`;
        }

        if (!path.extname(fileName)) {
            const ext = getExtensionFromContentType(response.headers['content-type']) || '.bin';
            fileName += ext;
        }

        return {
            success: true,
            buffer: Buffer.from(response.data),
            fileName: fileName,
            size: response.data.length
        };
    } catch (err) {
        return { success: false, error: `Buzzheavier: ${err.message}` };
    }
}

// ============================================================
// MAIN COMMAND HANDLER
// ============================================================
export default {
    command: ['mirror', 'gf', 'pd', 'bh', 'gofile', 'pixeldrain', 'buzzheavier'],
    execute: async (sock, m, { sender, q, isOwner }) => {
        const chatId = sender;
        
        // Detect command
        const msgType = Object.keys(m.message)[0];
        let cmd = msgType === 'conversation' 
            ? m.message.conversation.split(' ')[0].toLowerCase()
            : q.split(' ')[0].toLowerCase();
        
        // Remove dot prefix if exists
        cmd = cmd.replace('.', '');

        // ============================================================
        // MIRROR: Upload file to WhatsApp (upload to chat)
        // ============================================================
        if (cmd === 'mirror') {
            try {
                const msgType = Object.keys(m.message)[0];
                let fileBuffer, fileName, fileSize;

                // Check if replying to a file
                if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                    const quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const quotedType = Object.keys(quotedMsg)[0];

                    if (['documentMessage', 'videoMessage', 'audioMessage', 'imageMessage'].includes(quotedType)) {
                        try {
                            const stream = await downloadContentFromMessage(quotedMsg[quotedType], quotedType.replace('Message', ''));
                            const chunks = [];
                            for await (const chunk of stream) {
                                chunks.push(chunk);
                            }
                            fileBuffer = Buffer.concat(chunks);
                            fileName = quotedMsg[quotedType].fileName || `file_${Date.now()}`;
                            fileSize = fileBuffer.length;
                        } catch (err) {
                            return sock.sendMessage(chatId, { text: `❌ Error download file: ${err.message}` }, { quoted: m });
                        }
                    } else {
                        return sock.sendMessage(chatId, { text: '❌ Reply ke file (dokumen, video, audio, gambar)!' }, { quoted: m });
                    }
                }
                // Check if sending file directly
                else if (msgType && ['documentMessage', 'videoMessage', 'audioMessage', 'imageMessage'].includes(msgType)) {
                    try {
                        const stream = await downloadContentFromMessage(m.message[msgType], msgType.replace('Message', ''));
                        const chunks = [];
                        for await (const chunk of stream) {
                            chunks.push(chunk);
                        }
                        fileBuffer = Buffer.concat(chunks);
                        fileName = m.message[msgType].fileName || `file_${Date.now()}`;
                        fileSize = fileBuffer.length;
                    } catch (err) {
                        return sock.sendMessage(chatId, { text: `❌ Error download file: ${err.message}` }, { quoted: m });
                    }
                } else {
                    return sock.sendMessage(chatId, { text: '❌ Reply ke file atau kirim file dengan command `.mirror`!' }, { quoted: m });
                }

                // Send to WhatsApp
                const document = {
                    document: fileBuffer,
                    mimetype: 'application/octet-stream',
                    fileName: fileName
                };

                await sock.sendMessage(chatId, document, { quoted: m });
                await sock.sendMessage(chatId, {
                    text: `✅ Uploaded to Chat\n📁 ${fileName.slice(0, 30)}${fileName.length > 30 ? '...' : ''}\n💾 ${(fileSize / 1024 / 1024).toFixed(2)} MB`
                }, { quoted: m });

            } catch (error) {
                await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` }, { quoted: m });
            }
        }
        // ============================================================
        // DOWNLOAD COMMANDS: gf, pd, bh
        // ============================================================
        else if (['gf', 'gofile', 'pd', 'pixeldrain', 'bh', 'buzzheavier'].includes(cmd)) {
            if (!q || !q.includes('http')) {
                return sock.sendMessage(chatId, { text: `❌ Kasih URL!\n\nContoh: .${cmd} https://...` }, { quoted: m });
            }

            try {
                const urlMatch = q.match(/(https?:\/\/[^\s]+)/i);
                if (!urlMatch) {
                    return sock.sendMessage(chatId, { text: '❌ URL tidak valid!' }, { quoted: m });
                }

                const url = urlMatch[0];
                await sock.sendMessage(chatId, { text: `⏳ Downloading dari ${cmd.toUpperCase()}...` }, { quoted: m });

                let result;
                if (cmd === 'gf' || cmd === 'gofile') {
                    result = await downloadFromGofile(url);
                } else if (cmd === 'pd' || cmd === 'pixeldrain') {
                    result = await downloadFromPixeldrain(url);
                } else if (cmd === 'bh' || cmd === 'buzzheavier') {
                    result = await downloadFromBuzzheavier(url);
                }

                if (result.success) {
                    const document = {
                        document: result.buffer,
                        mimetype: 'application/octet-stream',
                        fileName: result.fileName
                    };

                    await sock.sendMessage(chatId, document, { quoted: m });
                    await sock.sendMessage(chatId, {
                        text: `✅ Downloaded from ${cmd.toUpperCase()}\n📁 ${result.fileName.slice(0, 40)}\n💾 ${(result.size / 1024 / 1024).toFixed(2)} MB`
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(chatId, { text: `❌ Download gagal!\n\n${result.error}` }, { quoted: m });
                }

            } catch (error) {
                await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` }, { quoted: m });
            }
        }
    }
};
