# Discord Voice Recorder with Real-time Transcription

🎙️ Discord bot ที่บันทึกเสียงและแปลงเป็นข้อความแบบ real-time โดยใช้ Colab API

## ✨ Features

- 🎤 บันทึกเสียงจาก Discord voice channels
- 🔄 แปลงเสียงเป็นข้อความแบบ real-time
- 🌐 ใช้ Colab API สำหรับการแปลงเสียง (ฟรี!)
- 📝 บันทึก transcripts ลงไฟล์
- 📊 สรุปการประชุมอัตโนมัติ
- 🛡️ Error handling และ retry mechanism

## 🚀 Quick Start

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
สร้างไฟล์ `.env`:
```env
DISCORD_TOKEN=
GOOGLE_APPLICATION_CREDENTIALS=
COLAB_API_URL=
```

### 3. ตั้งค่า Colab API
1. เปิด [Colab Notebook](thonburian_whisper_colab_fixed.ipynb)
2. รันทุก cell
3. คัดลอก ngrok URL
4. อัปเดต URL ใน `.env -> COLAB_API_URL`

### 4. รัน Bot
```bash
npm start
```

## 📋 Commands

| คำสั่ง | คำอธิบาย |
|--------|----------|
| `!join` | เข้าห้องเสียงและเริ่มบันทึก |
| `!leave` | ออกจากห้องเสียงและหยุดบันทึก |
| `!channel #channel` | ตั้งช่องสำหรับส่ง transcripts |

## 📁 Project Structure

```
discord-voice-recorder/
├── src/
│   ├── bot.ts              # Discord bot logic
│   ├── recorder.ts          # Voice recording
│   ├── converter.ts         # PCM to WAV conversion
│   ├── transcriber.ts       # Local Whisper fallback
│   ├── colab-api.ts         # Colab API integration
│   └── utils.ts             # Utility functions
├── recordings/              # Audio files & transcripts
├── whisper_transcribe.py    # Local Whisper script
└── thonburian_whisper_colab_fixed.ipynb  # Colab setup
```

## 🔧 Scripts

```bash
npm start          # รัน bot
npm run dev        # รันในโหมด development (watch)
npm run build      # Build TypeScript
npm run clean      # ลบไฟล์เสียงชั่วคราว
npm run clean:all  # ลบทุกไฟล์ใน recordings/
```

## 📊 Performance

- **Colab API**: เร็วและแม่นยำ (95%+ success rate)
- **Local Fallback**: Whisper สำหรับกรณี Colab ไม่พร้อม
- **Error Handling**: Retry mechanism และ graceful degradation

## 🛠️ Troubleshooting

### Colab API ไม่ทำงาน
1. ตรวจสอบ ngrok URL
2. รัน health check: `GET /health`
3. ตรวจสอบ Colab notebook

### ไฟล์เสียงเสียหาย
- ระบบจะข้ามไฟล์ที่มีปัญหา
- ใช้ local Whisper เป็น fallback

### Bot ไม่ตอบสนอง
1. ตรวจสอบ Discord token
2. ตรวจสอบ permissions
3. ดู logs ใน console

## 📝 License

ISC License

## 🤝 Contributing

1. Fork repository
2. สร้าง feature branch
3. Commit changes
4. Push to branch
5. สร้าง Pull Request

---

**Made with ❤️ for Thai language support** # bot-discord-voice-record
