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

// 👇 接口路径改为 /calculate，匹配你的前端
app.post('/calculate', (req, res) => {
  try {
    const { year, month, day, hour, minute = 0, gender = 'male' } = req.body;

    if (!year || !month || !day || hour === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: year, month, day, hour'
      });
    }

    const chart = new ZiWei({
      year,
      month,
      day,
      hour,
      minute,
      gender,
      location: '东八区'
    });

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
