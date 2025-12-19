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

app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

app.post('/calculate', (req, res) => {
  const { dateStr, timeIndex, gender } = req.body;

  // === 参数校验 ===
  if (!dateStr || timeIndex === undefined || !gender) {
    return res.status(400).json({
      status: "error",
      error: "缺少必要参数",
      required: ["dateStr", "timeIndex", "gender"],
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

  // === 校验 timeIndex 是否为 0-12 的整数 ===
  if (typeof timeIndex !== 'number' || !Number.isInteger(timeIndex) || timeIndex < 0 || timeIndex > 12) {
    return res.status(400).json({
      status: "error",
      error: "timeIndex 必须是 0-12 的整数",
      code: "INVALID_TIME_INDEX"
    });
  }

  // === 日期格式校验 ===
  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!dateRegex.test(dateStr)) {
    return res.status(400).json({
      status: "error",
      error: "日期格式错误，请使用 YYYY-MM-DD",
      code: "INVALID_DATE_FORMAT"
    });
  }

  // === 缓存检查 ===
  const cacheKey = `${dateStr}|${timeIndex}|${gender}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('✅ 命中缓存:', cacheKey);
    return res.json(cached.response);
  }

  // === 调用 iztro 排盘 ===
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

  // === 构造前端链接 ===
  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(dateStr)}&t=${hourForIztro}&g=${gender === '男' ? 'male' : 'female'}&type=solar`;

  // === 安全提取命盘数据 ===
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
      dateStr,
      timeIndex,
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
