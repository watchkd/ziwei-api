const express = require('express');
const { astro } = require('iztro');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

// 时辰索引 (0-12) → iztro 所需 hour (0-23)
const TIME_INDEX_TO_HOUR = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];

app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

app.post('/calculate', (req, res) => {
  const { dateStr, timeIndex, gender } = req.body;

  // === 1. 必填参数检查 ===
  if (!dateStr || timeIndex === undefined || !gender) {
    return res.status(400).json({
      status: "error",
      error: "缺少必要参数",
      required: ["dateStr", "timeIndex", "gender"],
      code: "MISSING_PARAMS"
    });
  }

  // === 2. 性别校验 ===
  if (gender !== '男' && gender !== '女') {
    return res.status(400).json({
      status: "error",
      error: "性别必须是 '男' 或 '女'",
      code: "INVALID_GENDER"
    });
  }

  // === 3. timeIndex 安全解析与校验 ===
  let parsedTimeIndex;
  if (typeof timeIndex === 'number') {
    if (!Number.isInteger(timeIndex)) {
      return res.status(400).json({
        status: "error",
        error: "timeIndex 必须是整数（不能带小数）",
        code: "INVALID_TIME_INDEX"
      });
    }
    parsedTimeIndex = timeIndex;
  } else if (typeof timeIndex === 'string') {
    const trimmed = timeIndex.trim();
    if (trimmed === '') {
      return res.status(400).json({
        status: "error",
        error: "timeIndex 不能为空字符串",
        code: "INVALID_TIME_INDEX"
      });
    }
    const num = Number(trimmed);
    if (isNaN(num) || !Number.isInteger(num)) {
      return res.status(400).json({
        status: "error",
        error: "timeIndex 必须是 0-12 的整数（如 '7' 或 7）",
        code: "INVALID_TIME_INDEX"
      });
    }
    parsedTimeIndex = num;
  } else {
    return res.status(400).json({
      status: "error",
      error: "timeIndex 类型无效，必须是数字或字符串",
      code: "INVALID_TIME_INDEX"
    });
  }

  if (parsedTimeIndex < 0 || parsedTimeIndex > 12) {
    return res.status(400).json({
      status: "error",
      error: "timeIndex 必须在 0 到 12 之间（含）",
      code: "INVALID_TIME_INDEX"
    });
  }

  // === 4. 日期格式校验 ===
  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!dateRegex.test(dateStr)) {
    return res.status(400).json({
      status: "error",
      error: "日期格式错误，请使用 YYYY-MM-DD（例如：1990-05-20）",
      code: "INVALID_DATE_FORMAT"
    });
  }

  // === 5. 缓存检查 ===
  const cacheKey = `${dateStr}|${parsedTimeIndex}|${gender}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('✅ 命中缓存:', cacheKey);
    return res.json(cached.response);
  }

  // === 6. 调用 iztro 排盘 ===
  const hourForIztro = TIME_INDEX_TO_HOUR[parsedTimeIndex];
  let astrolabe;
  try {
    astrolabe = astro.bySolar(dateStr, hourForIztro, gender, true, 'zh-CN');
  } catch (e) {
    const msg = e.message || '未知错误';
    console.error('❌ 排盘失败:', msg);

    if (msg.startsWith('wrong hour')) {
      return res.status(400).json({
        status: "error",
        error: "小时值无效，请联系开发者",
        code: "IZTRO_HOUR_ERROR"
      });
    }
    if (/(invalid|date|month|day|year)/i.test(msg)) {
      return res.status(400).json({
        status: "error",
        error: "日期不合法，请确保年月日真实存在",
        code: "INVALID_DATE_VALUE"
      });
    }
    return res.status(500).json({
      status: "error",
      error: "排盘服务内部错误",
      detail: process.env.NODE_ENV === 'development' ? msg : undefined,
      code: "INTERNAL_ERROR"
    });
  }

  // === 7. 构造前端链接 ===
  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(dateStr)}&t=${hourForIztro}&g=${gender === '男' ? 'male' : 'female'}&type=solar`;

  // === 8. 安全提取命盘数据（防止循环引用/函数等）===
  const safePalaces = astrolabe.palaces.map(p => ({
    name: p.name || '',
    branch: p.branch || '',
    majorStars: Array.isArray(p.majorStars) ? [...p.majorStars] : [],
    minorStars: Array.isArray(p.minorStars) ? [...p.minorStars] : [],
    adjectiveStars: Array.isArray(p.adjectiveStars) ? [...p.adjectiveStars] : [],
    hiddenStars: Array.isArray(p.hiddenStars) ? [...p.hiddenStars] : [],
    god: p.god || '',
    bodyMain: p.bodyMain || '',
    bodySecondary: p.bodySecondary || '',
    luckMain: p.luckMain || '',
    luckSecondary: p.luckSecondary || '',
    selfPalace: Boolean(p.selfPalace),
    oppositePalace: Boolean(p.oppositePalace),
  }));

  const safeDecadesLuck = (astrolabe.decadesLuck || []).map(d => ({
    startAge: d.startAge || 0,
    endAge: d.endAge || 0,
    palace: d.palace || '',
    stars: Array.isArray(d.stars) ? [...d.stars] : [],
    description: d.description || '',
  }));

  // === 9. 构造响应 ===
  const response = {
    status: "success",
    message: "紫微斗数排盘成功",
    frontend_url,
    chart_data: {
      input: {
        dateStr,
        timeIndex: parsedTimeIndex, // 标准化后的整数
        gender
      },
      resolvedHour: hourForIztro,
      gender: astrolabe.gender,
      solarDate: astrolabe.solarDate,
      lunarDate: astrolabe.lunarDate,
      chineseZodiac: astrolabe.chineseZodiac,
      fiveElementsClass: astrolabe.fiveElementsClass,
      lifePalaceBranch: astrolabe.lifePalaceBranch,
      palaces: safePalaces,
      decadesLuck: safeDecadesLuck,
    }
  };

  // === 10. 写入缓存 ===
  CACHE.set(cacheKey, {
    timestamp: Date.now(),
    response
  });

  // === 11. 安全返回 ===
  try {
    res.json(response);
  } catch (serializeErr) {
    console.error('❌ JSON 序列化失败:', serializeErr.message);
    res.status(500).json({
      status: "error",
      error: "命盘数据无法序列化，请联系开发者",
      code: "SERIALIZE_ERROR"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Ziwei API 已启动，监听端口: ${PORT}`);
});
