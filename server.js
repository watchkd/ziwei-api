const express = require('express');
const { astro } = require('iztro');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const TIME_INDEX_TO_HOUR = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];

function addOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ✅ 所有业务逻辑必须在这个回调里
app.post('/calculate', async (req, res) => {
  const { dateStr, timeIndex, gender } = req.body;

  // === 参数校验（你贴出的部分）===
  if (!dateStr || timeIndex === undefined || !gender) {
    return res.status(400).json({
      status: "error",
      error: "缺少必要参数",
      code: "MISSING_PARAMS"
    });
  }

  if (gender !== '男' && gender !== '女') {
    return res.status(400).json({
      status: "error",
      error: "性别必须是 '男' 或 '女'",
      code: "INVALID_GENDER"
    });
  }

  let parsedTimeIndex;
  if (typeof timeIndex === 'number') {
    if (!Number.isInteger(timeIndex)) {
      return res.status(400).json({
        status: "error",
        error: "timeIndex 必须是整数",
        code: "INVALID_TIME_INDEX"
      });
    }
    parsedTimeIndex = timeIndex;
  } else if (typeof timeIndex === 'string') {
    const trimmed = timeIndex.trim();
    if (trimmed === '') {
      return res.status(400).json({
        status: "error",
        error: "timeIndex 不能为空",
        code: "INVALID_TIME_INDEX"
      });
    }
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num < 0 || num > 12) {
      return res.status(400).json({
        status: "error",
        error: "timeIndex 必须是 0-12 的整数",
        code: "INVALID_TIME_INDEX"
      });
    }
    parsedTimeIndex = num;
  } else {
    return res.status(400).json({
      status: "error",
      error: "timeIndex 类型无效",
      code: "INVALID_TIME_INDEX"
    });
  }

  // === 处理日期和小时 ===
  let actualDate = dateStr;
  let hourForIztro;

  if (parsedTimeIndex === 12) {
    try {
      actualDate = addOneDay(dateStr);
    } catch (e) {
      return res.status(400).json({
        status: "error",
        error: "无法计算次日日期",
        code: "DATE_CALCULATION_ERROR"
      });
    }
    hourForIztro = 0;
  } else {
    hourForIztro = TIME_INDEX_TO_HOUR[parsedTimeIndex];
    if (hourForIztro === undefined) {
      return res.status(500).json({
        status: "error",
        error: "时辰索引映射失败",
        code: "HOUR_MAPPING_ERROR"
      });
    }
  }

  // === 调用 iztro ===
  let astrolabe;
  try {
    astrolabe = astro.bySolar(actualDate, hourForIztro, gender, true, 'zh-CN');
  } catch (e) {
    console.error('排盘失败:', e.message);
    return res.status(400).json({
      status: "error",
      error: `小时值 ${hourForIztro} 无效（应为 0-23）`,
      code: "IZTRO_HOUR_ERROR"
    });
  }

  // === 成功响应 ===
  res.json({
    status: "success",
    message: "排盘成功",
    data: {
      solarDate: astrolabe.solarDate,
      lunarDate: astrolabe.lunarDate,
      palaces: astrolabe.palaces.map(p => ({ name: p.name, majorStars: p.majorStars }))
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 服务已启动，端口: ${PORT}`);
});
