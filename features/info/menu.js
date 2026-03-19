import fs from 'fs';

// Helper: Menghitung Runtime
function runtime(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600 * 24));
	var h = Math.floor(seconds % (3600 * 24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);
	var dDisplay = d > 0 ? d + "d " : "";
	var hDisplay = h > 0 ? h + "h " : "";
	var mDisplay = m > 0 ? m + "m " : "";
	var sDisplay = s > 0 ? s + "s" : "0s";
	return (dDisplay + hDisplay + mDisplay + sDisplay).trim();
}

// Helper: Membuat garis aesthetic
function line(char = "═", length = 20) {
	return char.repeat(length);
}

// Helper: Format teks dengan box
function boxText(text, emoji = "📦") {
	return `${emoji} 『 ${text} 』 ${emoji}`;
}

export default {
    command: ['menu', 'help', 'list', 'commands'],
    execute: async (sock, m, { q, sender, pushName, isOwner }) => {
        
        // --- 1. FIX: ID CHAT AMAN ---
        const chatId = m.chat || m.key.remoteJid;
        if (!chatId) return;

        // --- 2. LOGIKA DETEKSI NAMA (LEBIH KUAT) ---
        const namaUser = pushName || m.pushName || 'Tanpa Nama';
        
        // --- 3. DATA LAINNYA DENGAN FORMAT LEBIH KEREN ---
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

        // --- 4. ISI MENU DENGAN TAMPILAN SUPER KEECE ---
        let menuText = `
╭━━━ ⬣ *𝐅𝐀𝐑𝐈𝐒 𝐁𝐎𝐓𝐙* ⬣ ━━━╮
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
┃ │ *.ig* / *.ig2* <link>
┃ │   → Instagram Video/Reel/Post
┃ │ 
┃ │ *.tt* <link>
┃ │   → TikTok (No Watermark)
┃ │ 
┃ │ *.mediafire* / *.mf* <link>
┃ │   → MediaFire Files
┃ │ 
┃ │ *.mp3* / *.download* <link>
┃ │   → YouTube to MP3
┃ │ 
┃ │ *.flac* / *.tidal* <judul>
┃ │   → Hi-Res FLAC Audio
┃ │
┃ ╭━━━━━━━━━━━━━━━━━━━━╮
┃ ┃  📤 *M I R R O R / F I L E*  ┃
┃ ╰━━━━━━━━━━━━━━━━━━━━╯
┃ │ *.mirror* <reply file>
┃ │   → Mirror file ke chat
┃ │ 
┃ │ *.gf* / *.gofile* <link>
┃ │   → Download dari Gofile
┃ │ 
┃ │ *.pd* / *.pixeldrain* <link>
┃ │   → Download dari Pixeldrain
┃ │ 
┃ │ *.bh* / *.buzzheavier* <link>
┃ │   → Download dari Buzzheavier
┃
┃ ╭━━━━━━━━━━━━━━━━━━━━╮
┃ ┃  🎨 *M E D I A & T O O L S*  ┃
┃ ╰━━━━━━━━━━━━━━━━━━━━╯
┃ │ *.sticker* / *.s* <reply>
┃ │   → Gambar/Video ➡️ Sticker
┃ │ 
┃ │ *.brat* <teks>
┃ │   → Buat Sticker Teks Brat
┃ │ 
┃ │ *.upscale* / *.hd* <reply>
┃ │   → Perjernih/HD Foto
┃ │ 
┃ │ *.removebg* / *.rmbg* <reply>
┃ │   → Hapus Background
┃
┃ ╭━━━━━━━━━━━━━━━━━━━━╮
┃ ┃  ⛩️ *A N I M E & M A N G A*  ┃
┃ ╰━━━━━━━━━━━━━━━━━━━━╯
┃ │ *.komiku* <judul>
┃ │   → Cari & Baca Manga Indo
┃ │ 
┃ │ *.animexin* / *.anime* <judul>
┃ │   → Cari Anime Terbaru
┃ │ 
┃ │ *.kusonime* / *.kuso* <judul>
┃ │   → Download Anime Batch
┃ │ 
┃ │ *.mal* <judul>
┃ │   → Info MyAnimeList Detail
┃
┃ ╭━━━━━━━━━━━━━━━━━━━━╮
┃ ┃  ⚙️ *S Y S T E M & I N F O*  ┃
┃ ╰━━━━━━━━━━━━━━━━━━━━╯
┃ │ *.ping*
┃ │   → Cek Kecepatan Respon Bot
┃ │ 
┃ │ *.neofetch*
┃ │   → Cek Info Spesifikasi VPS
┃ │ 
┃ │ *.setpp*
┃ │   → Ganti Foto Profil Bot
┃ │
┃ ╭───────────────────────╮
┃ │  📊 *Total Fitur: 56*   │
┃ ╰───────────────────────╯
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯
✨ *Created By Faris Suka Mie Ayam* ✨
🔥 *Powered by NodeJS & WhatsApp Web* 🔥
`;

        // --- 5. CONFIG GAMBAR ---
        const imageUrl = 'https://files.catbox.moe/2txmah.jpg'; 

        try {
            await sock.sendMessage(chatId, { 
                image: { url: imageUrl }, 
                caption: menuText,
                contextInfo: {
                    externalAdReply: {
                        title: "🌟 𝐅𝐀𝐑𝐈𝐒 𝐁𝐎𝐓𝐙 𝐏𝐑𝐄𝐌𝐈𝐔𝐌 🌟",
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