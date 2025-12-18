const express = require('express');
const { astro, getStars } = require('iztro'); // 引入 getStars 用于完整星曜
const cors = require('cors');

const app = express();

// 启用 CORS 和 JSON 解析
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * 健康检查接口 - 用于 Zeabur 探活
 */
app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

/**
 * 紫微斗数排盘接口
 * 
 * 关键修复：
 * - 第4个参数设为 true：禁用 iztro 自动时区修正（避免 13 → 25）
 * - 使用 getStars() 获取完整星曜列表
 * - 所有响应返回 HTTP 200，业务状态通过 status 字段表示
 */
app.post('/calculate', (req, res) => {
  const { dateStr, timeIndex, gender } = req.body;

  // 1. 必填参数校验
  if (!dateStr || timeIndex === undefined || !gender) {
    return res.json({
      status: "error",
      error: "缺少必要参数",
      required: ["dateStr (格式 YYYY-MM-DD)", "timeIndex (0-23)", "gender (男/女)"],
      code: "MISSING_PARAMS"
    });
  }

  // 2. 性别校验
  if (gender !== '男' && gender !== '女') {
    return res.json({
      status: "error",
      error: "性别必须是 '男' 或 '女'",
      code: "INVALID_GENDER"
    });
  }

  // 3. 小时值校验（0-23 整数）
  const hour = Number(timeIndex);
  if (
    isNaN(hour) ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    return res.json({
      status: "error",
      error: `出生小时必须是 0-23 的整数，当前值: ${timeIndex}`,
      code: "INVALID_HOUR"
    });
  }

  // 4. 日期格式校验（YYYY-MM-DD）
  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!dateRegex.test(dateStr)) {
    return res.json({
      status: "error",
      error: "日期格式错误，请使用 YYYY-MM-DD 格式（例如：1990-05-20）",
      code: "INVALID_DATE_FORMAT"
    });
  }

  // 5. 调用 iztro 排盘（关键：第4个参数设为 true，禁用自动时区修正）
  let astrolabe;
  try {
    // bySolar(date, hour, gender, useZone, lang)
    // useZone = true 表示「不自动调整时区」，直接使用用户输入的小时
    astrolabe = astro.bySolar(dateStr, hour, gender, true, 'zh-CN');
  } catch (e) {
    const msg = e.message || '未知错误';

    if (msg.startsWith('wrong hour')) {
      const invalidHour = msg.replace('wrong hour ', '');
      return res.json({
        status: "error",
        error: `出生小时无效：${invalidHour}。请确保小时为 0-23 的整数。`,
        detail: msg,
        code: "INVALID_HOUR"
      });
    }

    if (
      msg.includes('date') ||
      msg.includes('Date') ||
      msg.includes('invalid') ||
      msg.includes('month') ||
      msg.includes('day') ||
      msg.includes('year')
    ) {
      return res.json({
        status: "error",
        error: "日期不合法，请确保年月日真实存在（例如：2023-02-30 是无效日期）。",
        detail: msg,
        code: "INVALID_DATE_VALUE"
      });
    }

    return res.json({
      status: "error",
      error: "排盘服务暂时不可用，请稍后再试。",
      detail: msg,
      code: "INTERNAL_ERROR"
    });
  }

  // 6. 获取完整星曜数据（解决排盘结果不全问题）
  const starsData = getStars(astrolabe); // 返回所有宫位的完整星曜

  // 找到命宫索引
  const mingPalaceIndex = astrolabe.palaces.findIndex(p => p.name === '命宫');
  if (mingPalaceIndex === -1) {
    return res.json({
      status: "error",
      error: "未找到命宫",
      code: "MISSING_MING_PALACE"
    });
  }

  // 获取命宫对应的完整星曜
  const mingPalaceStars = starsData[mingPalaceIndex];
  if (!mingPalaceStars) {
    return res.json({
      status: "error",
      error: "命宫星曜数据缺失",
      code: "MISSING_STARS_DATA"
    });
  }

  // 构造完整的 minorStars 列表
  const completeMinorStars = mingPalaceStars.stars.map(star => ({
    name: star.name,
    brightness: star.brightness || '',
    scope: star.scope || 'origin',
    position: star.position || ''
  }));

  // 7. 构造前端命盘查看链接
  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(astrolabe.solarDate)}&t=${astrolabe.timeIndex}&g=${astrolabe.gender === '男' ? 'male' : 'female'}&type=solar`;

  // 8. 成功响应（包含完整星曜）
  res.json({
    status: "success",
    message: "紫微排盘成功",
    frontend_url,
    data: {
      gender: astrolabe.gender,
      solarDate: astrolabe.solarDate,
      chineseZodiac: astrolabe.chineseZodiac,
      fiveElements: astrolabe.fiveElementsClass,
      lifePalaceBranch: astrolabe.lifePalaceBranch,
      ming_palace: {
        ...astrolabe.palaces[mingPalaceIndex],
        minorStars: completeMinorStars // 替换为完整星曜
      }
    }
  });
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Ziwei API 服务已启动，监听端口: ${PORT}`);
});
