const express = require('express');
const cors = require('cors');

// 🔧 安全加载 ZiWei（兼容 ESM / CommonJS）
const iztroModule = require('iztro');
const ZiWei = iztroModule.ZiWei || (iztroModule.default && iztroModule.default.ZiWei);

if (!ZiWei) {
  console.error('❌ iztro module structure unexpected:', iztroModule);
  throw new Error('Cannot find ZiWei class in iztro module');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 十二时辰映射
const TIME_INDEX_TO_HOUR = {
  0: 0,   // 子时
  1: 2,   // 丑时
  2: 4,   // 寅时
  3: 6,   // 卯时
  4: 8,   // 辰时
  5: 10,  // 巳时
  6: 12,  // 午时
  7: 14,  // 未时
  8: 16,  // 申时
  9: 18,  // 酉时
  10: 20, // 戌时
  11: 22  // 亥时
};

app.get('/', (req, res) => {
  res.json({ message: 'ZiWei API - Fixed ZiWei constructor' });
});

app.post('/calculate', (req, res) => {
  console.log('📥 Received:', req.body);

  try {
    const { dateStr, timeIndex, gender } = req.body;

    if (!dateStr || timeIndex === undefined) {
      return res.status(400).json({ error: 'Missing dateStr or timeIndex' });
    }

    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const day = parseInt(dayStr);
    const hour = TIME_INDEX_TO_HOUR[parseInt(timeIndex)] ?? 12;
    const parsedGender = (gender === '女') ? 'female' : 'male';

    console.log('✅ Parsed:', { year, month, day, hour, gender: parsedGender });

    // ✅ 现在 ZiWei 是有效的构造函数
    const chart = new ZiWei({
      year,
      month,
      day,
      hour,
      minute: 0,
      gender: parsedGender,
      location: '东八区'
    });

    res.json(chart.toJSON());

  } catch (err) {
    console.error('💥 Chart error:', err);
    res.status(500).json({
      error: 'Failed to generate chart',
      message: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
