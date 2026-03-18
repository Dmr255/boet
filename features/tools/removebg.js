import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// =================================================================
// 1. KODE API RESMI REMOVE.BG
// =================================================================
async function removeBg(filePath) {
  try {
    const form = new FormData();
    // Di API resmi, namanya harus 'image_file'
    form.append('image_file', fs.createReadStream(filePath));
    form.append('size', 'auto');

    const res = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
      headers: {
        ...form.getHeaders(),
        'X-Api-Key': 's9bHNPbxaLfpqjJDTJShVNbU', // <-- GANTI PAKE API KEY LU
      },
      responseType: 'arraybuffer', // Wajib biar balikannya langsung file gambar
    });

    return res.data; // Ini ngereturn buffer gambar langsung

  } catch (e) {
    const errorMsg = e.response ? e.response.statusText : e.message;
    console.error("Axios API Error:", errorMsg);
    throw new Error("API Remove.bg error atau limit habis bre.");
  }
}

// =================================================================
// 2. HANDLER BOT ACUMALAKA
// =================================================================
export default {
    command: ['removebg', 'rmbg', 'nobg'],
    execute: async (sock, m, { sender }) => {
        const isQuotedImage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        const isImage = m.message?.imageMessage;
        const targetMessage = isQuotedImage || isImage;

        if (!targetMessage) {
            return sock.sendMessage(sender, { 
                text: '❌ Reply fotonya dengan perintah *.rmbg* atau kirim foto dengan caption *.rmbg* Bos!' 
            }, { quoted: m });
        }

        await sock.sendMessage(sender, { text: '✂️ Sedang menghapus latar belakang gambar, mohon tunggu...' }, { quoted: m });

        const outputDir = path.join(__dirname, '../../temp_downloads');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const tempFilePath = path.join(outputDir, `rmbg_input_${Date.now()}.jpg`);

        try {
            const stream = await downloadContentFromMessage(targetMessage, 'image');
            let buffer = Buffer.from([]);
            for await(const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            fs.writeFileSync(tempFilePath, buffer);

            // Proses ke API remove.bg
            const imageBuffer = await removeBg(tempFilePath);

            // Kirim balik ke user (Ubah url jadi kirim langsung buffernya)
            await sock.sendMessage(sender, { 
                document: imageBuffer, 
                mimetype: 'image/png',
                fileName: `RemoveBG_${Date.now()}.png`,
                caption: '✅ *Berhasil menghapus background!*\n_Gambar dikirim sebagai dokumen agar transparansinya terjaga._' 
            }, { quoted: m });

        } catch (error) {
            console.error("RemoveBG Error:", error);
            sock.sendMessage(sender, { text: `❌ Gagal memproses gambar: ${error.message}` }, { quoted: m });
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }
};
