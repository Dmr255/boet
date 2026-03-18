import fs from 'fs';
import { config } from '../config.js';

function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s > 0 ? s + 's' : '0s'}`;
}

function line(char = "═", length = 20) {
    return char.repeat(length);
}

export default {
    command: ['menu', 'help', 'list', 'commands'],
    execute: async (sock, m, { q, sender, pushName, isOwner }) => {
        const chatId = m.chat || m.key.remoteJid;
        if (!chatId) return;

        const namaUser = pushName || m.pushName || 'Tanpa Nama';
        
        const timeWIB = new Date().toLocaleTimeString('id-ID', { 
            timeZone: 'Asia/Jakarta',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const dateWIB = new Date().toLocaleDateString('id-ID', { 
            timeZone: 'Asia/Jakarta',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        const senderNumber = sender.split('@')[0];
        const status = isOwner ? '𝐎𝐖𝐍𝐄𝐑' : '𝐔𝐒𝐄𝐑';
        const statusEmoji = isOwner ? '👑' : '⚔️';
        const botRuntime = runtime(process.uptime());

        const menuText = `
╭━━━ ⬣ *𝐃𝐀𝐌𝐀𝐑 𝐁𝐎𝐓𝐙* ⬣ ━━━╮
┃ ╭───────────────────────╮
┃ │   ✦ *I N F O   U S E R* ✦   │
┃ ╰───────────────────────╯
┃ ╭───────────────────────╮
┃ │ 👤 *Nama*    : ${namaUser}
┃ │ 📱 *Nomor*   : ${senderNumber}
┃ │ ${statusEmoji} *Status*  : ${status}
┃ │ 📅 *Tanggal* : ${dateWIB}
┃ │ ⏰ *Jam*     : ${timeWIB} WIB
┃ │ ⏱️ *Uptime*  : ${botRuntime}
┃ ╰───────────────────────╯
┃ 
┃    ✦ 𝗛𝗮𝗹𝗼, ${namaUser}! ✦
┃   ${line("~", 25)}
┃
┃ ╭━━━━━━━━━━━━━━━━━━━━╮
┃ ┃  📥 *D O W N L O A D E R*  ┃
┃ ╰━━━━━━━━━━━━━━━━━━━━╯
┃ │ 1.  *.ig* <link>
┃ │    ↳ Instagram Video/Reel/Post
┃ │ 2.  *.ig2* <link>
┃ │    ↳ Instagram Versi Backup
┃ │ 3.  *.tt* <link>
┃ │    ↳ TikTok No Watermark
┃ │ 4.  *.mediafire* / *.mf* <link>
┃ │    ↳ MediaFire Downloader
┃ │ 5.  *.mp3* <link>
┃ │    ↳ YouTube to MP3
┃ │ 6.  *.flac* <judul>
┃ │    ↳ Download Lagu Hi-Res FLAC
┃
┃ ╭━━━━━━━━━━━━━━━━━━━━╮
┃ ┃  🎨 *M E D I A & T O O L S*  ┃
┃ ╰━━━━━━━━━━━━━━━━━━━━╯
┃ │ 7.  *.sticker* / *.s*
┃ │    ↳ Gambar/Video ➡️ Sticker
┃ │ 8.  *.brat* <teks>
┃ │    ↳ Buat Sticker Teks Brat
┃ │ 9.  *.upscale*
┃ │    ↳ Perjernih Foto/HD (reply image)
┃ │ 10. *.removebg*
┃ │    ↳ Hapus Background Foto
┃ │ 11. *.mirror* / *.upload* / *.up*
┃ │    ↳ Mirror File ke tmpfiles.org
┃
┃ ╭━━━━━━━━━━━━━━━━━━━━╮
┃ ┃  ⛩️ *A N I M E & M A N G A*  ┃
┃ ╰━━━━━━━━━━━━━━━━━━━━╯
┃ │ 12. *.komiku* <judul>
┃ │    ↳ Cari/Baca Manga Indo
┃ │ 13. *.animexin* <judul>
┃ │    ↳ Cari Anime Terbaru
┃ │ 14. *.kusonime* <judul>
┃ │    ↳ Download Anime Batch
┃ │ 15. *.mal* <judul>
┃ │    ↳ Info Detail MyAnimeList
┃
┃ ╭━━━━━━━━━━━━━━━━━━━━╮
┃ ┃  ⚙️ *S Y S T E M & O W N E R* ┃
┃ ╰━━━━━━━━━━━━━━━━━━━━╯
┃ │ 16. *.ping*
┃ │    ↳ Cek Kecepatan Respon Bot
┃ │ 17. *.neofetch*
┃ │    ↳ Cek Info Spesifikasi VPS
┃ │ 18. *.setpp*
┃ │    ↳ Ganti Foto Profil Bot
┃ │ 19. *.owner* / *.creator*
┃ │    ↳ Info Pembuat Bot
┃
┃ ╭───────────────────────╮
┃ │  📊 *Total Fitur: 19*   │
┃ ╰───────────────────────╯
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯
✨ ${config.footer} ✨
🔥 *Powered by NodeJS & WhatsApp Web* 🔥
`;

        const imageUrl = 'https://files.catbox.moe/2txmah.jpg'; 

        try {
            await sock.sendMessage(chatId, { 
                image: { url: imageUrl }, 
                caption: menuText,
                contextInfo: {
                    externalAdReply: {
                        title: "🌟 𝐃𝐀𝐌𝐀𝐑 𝐁𝐎𝐓𝐙 𝐏𝐑𝐄𝐌𝐈𝐔𝐌 🌟",
                        body: `Halo ${namaUser}! Ketik .menu untuk lihat fitur`,
                        thumbnailUrl: imageUrl,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });

        } catch (error) {
            console.log("⚠️ Gambar error, kirim teks saja.");
            await sock.sendMessage(chatId, { text: menuText });
        }
    }
};