const express = require('express');
const { astro } = require('iztro');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// === 时辰索引 → iztro hour 映射表 ===
const TIME_INDEX_TO_HOUR = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]; // length=13

function convertToZiweiHourIndex(timeInput) {
  let totalMinutes = -1;

  if (typeof timeInput === 'number') {
    if (isNaN(timeInput) || timeInput < 0 || timeInput > 24) {
      throw new Error('小时必须在 0–24 之间');
    }
    totalMinutes = Math.floor(timeInput * 60);
  } else if (typeof timeInput === 'string') {
    const clean = timeInput.trim();
    const match = clean.match(/^(\d{1,2}):?(\d{0,2})$/);
    if (!match) {
      throw new Error('时间格式无效，请使用 "14:45" 或 "14"');
    }
    let [_, hourStr, minStr = '0'] = match;
    let hour = parseInt(hourStr, 10);
    let minute = parseInt(minStr, 10);

    if (hour < 0 || hour > 24 || minute < 0 || minute >= 60) {
      throw new Error('时间超出有效范围');
    }
    if (hour === 24 && minute > 0) throw new Error('24点仅允许 24:00');
    if (hour === 24) hour = 0;

    totalMinutes = hour * 60 + minute;
  } else {
    throw new Error('时间格式不支持');
  }

  if (totalMinutes === 24 * 60) totalMinutes = 0;
  if (totalMinutes < 0 || totalMinutes >= 24 * 60) {
    throw new Error('时间必须在 00:00 到 24:00 之间');
  }

  if (totalMinutes < 60) return 0;
  if (totalMinutes < 180) return 1;
  if (totalMinutes < 300) return 2;
  if (totalMinutes < 420) return 3;
  if (totalMinutes < 540) return 4;
  if (totalMinutes < 660) return 5;
  if (totalMinutes < 780) return 6;
  if (totalMinutes < 900) return 7;
  if (totalMinutes < 1020) return 8;
  if (totalMinutes < 1140) return 9;
  if (totalMinutes < 1260) return 10;
  if (totalMinutes < 1380) return 11;
  if (totalMinutes < 1440) return 12;

  throw new Error('无法识别的时间段');
}

app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

app.post('/calculate', (req, res) => {
  const { dateStr, timeInput, gender } = req.body;

  if (!dateStr || timeInput === undefined || !gender) {
    return res.status(400).json({
      status: "error",
      error: "缺少必要参数",
      required: ["dateStr", "timeInput", "gender"],
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

  let timeIndex;
  try {
    timeIndex = convertToZiweiHourIndex(timeInput);
  } catch (e) {
    return res.status(400).json({
      status: "error",
      error: e.message,
      code: "INVALID_TIME_FORMAT"
    });
  }

  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!dateRegex.test(dateStr)) {
    return res.status(400).json({
      status: "error",
      error: "日期格式错误，请使用 YYYY-MM-DD",
      code: "INVALID_DATE_FORMAT"
    });
  }

  const cacheKey = `${dateStr}|${timeIndex}|${gender}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('✅ 命中缓存:', cacheKey);
    return res.json(cached.response);
  }

  const hourForIztro = TIME_INDEX_TO_HOUR[timeIndex];
  let astrolabe;
  try {
    astrolabe = astro.bySolar(dateStr, hourForIztro, gender, true, 'zh-CN');
  } catch (e) {
    const msg = e.message || '未知错误';
    console.error('❌ 排盘失败:', msg);

    if (msg.startsWith('wrong hour')) {
      return res.status(400).json({ status: "error", error: "小时无效", code: "INVALID_HOUR" });
    }
    if (/(invalid|date|month|day|year)/i.test(msg)) {
      return res.status(400).json({ status: "error", error: "日期不合法", code: "INVALID_DATE_VALUE" });
    }
    return res.status(500).json({ status: "error", error: "内部错误", code: "INTERNAL_ERROR" });
  }

  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(dateStr)}&t=${hourForIztro}&g=${gender === '男' ? 'male' : 'female'}&type=solar`;

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

  const response = {
    status: "success",
    message: "紫微斗数排盘成功",
    frontend_url,
    chart_data: {
      inputTime: timeInput,
      timeIndex: timeIndex,         // 插件标准输入（0-12）
      resolvedHour: hourForIztro,   // 实际用于排盘的 hour（0-23）
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

  CACHE.set(cacheKey, { timestamp: Date.now(), response });

  try {
    res.json(response);
  } catch (err) {
    console.error('❌ 序列化失败:', err.message);
    res.status(500).json({ status: "error", error: "数据格式异常", code: "SERIALIZE_ERROR" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Ziwei API 启动，端口: ${PORT}`);
});
