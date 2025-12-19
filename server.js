const express = require('express');
const cors = require('cors');
const { ZiWei } = require('iztro');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 健康检查
app.get('/', (req, res) => {
  res.json({ message: 'ZiWei API is running!', version: '2.5.3' });
});

// 紫微斗数排盘接口
app.post('/chart', (req, res) => {
  try {
    const { year, month, day, hour, minute = 0, gender = 'male' } = req.body;

    // 参数校验
    if (!year || !month || !day || hour === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: year, month, day, hour'
      });
    }

    // 创建命盘
    const chart = new ZiWei({
      year,
      month,
      day,
      hour,
      minute,
      gender, // 'male' or 'female'
      location: '东八区' // 固定时区，避免 DST 问题
    });

    // 返回完整命盘数据
    res.json(chart.toJSON());

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to generate chart',
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
