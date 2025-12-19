const express = require('express');
const cors = require('cors');
const { ZiWei } = require('iztro');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'ZiWei API - Ready for plugin format' });
});

// 十二时辰映射：timeIndex → 小时（取中间值）
const TIME_INDEX_TO_HOUR = {
  0: 0,   // 子时 23-1 → 用 0（特殊处理，跨日）
  1: 2,   // 丑时
  2: 4,   // 寅时
  3: 6,   // 卯时
  4: 8,   // 辰时
  5: 10,  // 巳时 ✅
  6: 12,  // 午时
  7: 14,  // 未时
  8: 16,  // 申时
  9: 18,  // 酉时
  10: 20, // 戌时
  11: 22  // 亥时
};

app.post('/calculate', (req, res) => {
  console.log('📥 Received:', req.body);

  try {
    const { dateStr, timeIndex, gender } = req.body;

    // 解析日期
    if (!dateStr || !timeIndex) {
      return res.status(400).json({
        error: 'Missing dateStr or timeIndex',
        received: req.body
      });
    }

    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) {
      return res.status(400).json({ error: 'Invalid dateStr format, expected YYYY-MM-DD' });
    }

    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    const hour = TIME_INDEX_TO_HOUR[parseInt(timeIndex)] ?? 12; // 默认午时

    const parsedGender = (gender === '女' || gender === 'female') ? 'female' : 'male';

    console.log('✅ Parsed:', { year, month, day, hour, gender: parsedGender });

    // 生成命盘
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
    console.error('💥 Error:', err);
    res.status(500).json({
      error: 'Failed to generate chart',
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
