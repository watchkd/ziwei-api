const express = require('express');
const { astro } = require('iztro');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

app.post('/calculate', (req, res) => {
  const { dateStr, timeIndex, gender } = req.body;

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

  let hour;
  if (typeof timeIndex === 'number') {
    hour = timeIndex;
  } else if (typeof timeIndex === 'string') {
    hour = Number(timeIndex.trim());
  } else {
    return res.status(400).json({
      status: "error",
      error: "timeIndex 必须是数字或可转为数字的字符串",
      code: "INVALID_HOUR_TYPE"
    });
  }

  if (isNaN(hour) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return res.status(400).json({
      status: "error",
      error: `出生小时无效：必须是 0-23 的整数，当前值: ${timeIndex}`,
      code: "INVALID_HOUR_RANGE"
    });
  }

  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!dateRegex.test(dateStr)) {
    return res.status(400).json({
      status: "error",
      error: "日期格式错误，请使用 YYYY-MM-DD（例如：1990-05-20）",
      code: "INVALID_DATE_FORMAT"
    });
  }

  let astrolabe;
  try {
    astrolabe = astro.bySolar(dateStr, hour, gender, true, 'zh-CN');
  } catch (e) {
    const msg = e.message || String(e);

    if (msg.includes('wrong hour')) {
      return res.status(400).json({
        status: "error",
        error: `小时值无效：${msg}. 请确保为 0-23 的整数.`,
        code: "IZTRO_HOUR_ERROR"
      });
    }

    if (msg.includes('invalid') || msg.includes('date') || msg.includes('month') || msg.includes('day')) {
      return res.status(400).json({
        status: "error",
        error: "日期不合法（如 2月30日）或超出范围",
        detail: msg,
        code: "INVALID_DATE_VALUE"
      });
    }

    return res.status(500).json({
      status: "error",
      error: "排盘服务内部错误",
      detail: msg,
      code: "INTERNAL_ERROR"
    });
  }

  // 提取命宫地支（所有版本都支持）
  const lifePalaceBranch = astrolabe.lifePalaceBranch;

  // 安全提取身宫（0.8.0+ 支持，旧版忽略）
  let bodyPalaceBranch = null;
  let shenGongName = null;
  try {
    if (astrolabe && typeof astrolabe.bodyPalaceBranch !== 'undefined') {
      bodyPalaceBranch = astrolabe.bodyPalaceBranch;
      const shenGongPalace = astrolabe.palaces.find(p => p.branch === bodyPalaceBranch);
      shenGongName = shenGongPalace ? shenGongPalace.name : null;
    }
  } catch (e) {
    console.warn('⚠️ 身宫信息不可用，跳过。');
  }

  // 构造十二宫（标记命宫，有条件标记身宫）
  const palaces = astrolabe.palaces.map(p => ({
    name: p.name,
    branch: p.branch,
    isMingGong: p.branch === lifePalaceBranch,
    isShenGong: bodyPalaceBranch ? (p.branch === bodyPalaceBranch) : false,
    majorStars: Array.isArray(p.majorStars) ? p.majorStars : [],
    minorStars: Array.isArray(p.minorStars) ? p.minorStars : [],
    adjectiveStars: Array.isArray(p.adjectiveStars) ? p.adjectiveStars : [],
    hiddenStars: Array.isArray(p.hiddenStars) ? p.hiddenStars : []
  }));

  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(dateStr)}&t=${hour}&g=${gender === '男' ? 'male' : 'female'}&type=solar`;

  res.status(200).json({
    status: "success",
    message: "紫微斗数排盘成功",
    note: bodyPalaceBranch ? null : "当前环境未返回身宫信息，已跳过。",
    frontend_url,
    data: {
      gender: astrolabe.gender,
      solarDate: astrolabe.solarDate,
      lunarDate: astrolabe.lunarDate,
      chineseZodiac: astrolabe.chineseZodiac,
      fiveElements: astrolabe.fiveElementsClass,
      lifePalaceBranch,
      bodyPalaceBranch,
      shenGongName,
      palaces,
      transformations: astrolabe.transformations || null,
      patterns: Array.isArray(astrolabe.patterns) ? astrolabe.patterns : [],
      decades: Array.isArray(astrolabe.decades) ? astrolabe.decades : [],
      yearPillar: astrolabe.yearPillar || '',
      monthPillar: astrolabe.monthPillar || '',
      dayPillar: astrolabe.dayPillar || '',
      hourPillar: astrolabe.hourPillar || ''
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Ziwei API 已启动，监听端口: ${PORT}`);
});
