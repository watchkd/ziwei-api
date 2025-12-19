const express = require('express');
const cors = require('cors');
const { ZiWei } = require('iztro');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 健康检查
app.get('/', (req, res) => {
  res.json({ message: 'ZiWei API v2.5.3 - Ready for /calculate' });
});

// 主接口：/calculate
app.post('/calculate', (req, res) => {
  console.log('🔍 Raw request body:', JSON.stringify(req.body, null, 2));

  try {
    // 尝试从多层结构中提取参数
    let data = req.body;

    // 如果有 data 字段（如飞书/钉钉插件）
    if (req.body.data && typeof req.body.data === 'object') {
      data = req.body.data;
    }
    // 如果有 payload 或 params
    if (req.body.payload && typeof req.body.payload === 'object') {
      data = req.body.payload;
    }
    if (req.body.params && typeof req.body.params === 'object') {
      data = req.body.params;
    }

    // 智能提取年月日时
    const year =
      data.year ||
      data.birthYear ||
      data.y ||
      data.年 ||
      (data.birthday ? new Date(data.birthday).getFullYear() : null);

    const month =
      data.month ||
      data.birthMonth ||
      data.m ||
      data.月 ||
      (data.birthday ? new Date(data.birthday).getMonth() + 1 : null);

    const day =
      data.day ||
      data.birthDay ||
      data.d ||
      data.日 ||
      (data.birthday ? new Date(data.birthday).getDate() : null);

    let hour =
      data.hour ||
      data.birthHour ||
      data.h ||
      data.时;

    const gender =
      (data.gender === 'female' || data.gender === '女' || data.sex === 0 || data.sex === 'F') ? 'female' :
      'male';

    // 强制转为数字
    const numYear = parseInt(year);
    const numMonth = parseInt(month);
    const numDay = parseInt(day);
    const numHour = parseInt(hour);

    console.log('🎯 Parsed:', { year: numYear, month: numMonth, day: numDay, hour: numHour, gender });

    // 校验
    if (!numYear || !numMonth || !numDay || numHour === undefined || isNaN(numHour)) {
      return res.status(400).json({
        error: 'Missing or invalid: year, month, day, hour',
        received: req.body,
        parsed: { year, month, day, hour, gender }
      });
    }

    // 生成命盘（v2.5.3 完整支持身宫）
    const chart = new ZiWei({
      year: numYear,
      month: numMonth,
      day: numDay,
      hour: numHour,
      minute: 0,
      gender,
      location: '东八区'
    });

    res.json(chart.toJSON());

  } catch (err) {
    console.error('💥 Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
