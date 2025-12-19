const express = require('express');
const { astro } = require('iztro'); // iztro 只导出 astro
const cors = require('cors');

const app = express();

// 启用 CORS 和 JSON 解析
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// === 内存缓存（可选但推荐）===
const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 缓存 10 分钟

function getCacheKey(dateStr, hour, gender) {
  return `${dateStr}|${hour}|${gender}`;
}

/**
 * 健康检查接口（用于 Zeabur 探活）
 */
app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

/**
 * 紫微斗数排盘接口
 * 
 * 支持：
 * - 日期格式：YYYY-MM-DD
 * - 小时范围：0–23（整数）
 * - 性别：'男' 或 '女'
 * 
 * 修复：
 * - 13点变25点 → bySolar 第4参数设为 true（禁用时区修正）
 * - t=undefined → 使用原始 hour 构造 URL
 * - getStars 报错 → 移除该函数（iztro 不支持）
 */
app.post('/calculate', (req, res) => {
  const { dateStr, timeIndex, gender } = req.body;

  // === 参数校验 ===
  if (!dateStr || timeIndex === undefined || !gender) {
    return res.json({
      status: "error",
      error: "缺少必要参数",
      required: ["dateStr (格式 YYYY-MM-DD)", "timeIndex (0-23 的整数)", "gender ('男' 或 '女')"],
      code: "MISSING_PARAMS"
    });
  }

  if (gender !== '男' && gender !== '女') {
    return res.json({
      status: "error",
      error: "性别必须是 '男' 或 '女'",
      code: "INVALID_GENDER"
    });
  }

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

  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!dateRegex.test(dateStr)) {
    return res.json({
      status: "error",
      error: "日期格式错误，请使用 YYYY-MM-DD（例如：1990-05-20）",
      code: "INVALID_DATE_FORMAT"
    });
  }

  // === 缓存检查 ===
  const cacheKey = getCacheKey(dateStr, hour, gender);
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('✅ 命中缓存:', cacheKey);
    return res.json(cached.response);
  }

  // === 调用 iztro 排盘 ===
  let astrolabe;
  try {
    // 第4个参数为 true → 禁用自动时区/真太阳时修正
    astrolabe = astro.bySolar(dateStr, hour, gender, true, 'zh-CN');
  } catch (e) {
    const msg = e.message || '未知错误';

    if (msg.startsWith('wrong hour')) {
      const invalidHour = msg.replace('wrong hour ', '');
      return res.json({
        status: "error",
        error: `出生小时无效：${invalidHour}。请确保为 0-23 的整数。`,
        detail: msg,
        code: "INVALID_HOUR"
      });
    }

    if (
      msg.includes('invalid') ||
      msg.includes('date') ||
      msg.includes('month') ||
      msg.includes('day') ||
      msg.includes('year')
    ) {
      return res.json({
        status: "error",
        error: "日期不合法，请确保年月日真实存在（如 2023-02-30 无效）。",
        detail: msg,
        code: "INVALID_DATE_VALUE"
      });
    }

    return res.json({
      status: "error",
      error: "排盘服务内部错误，请稍后再试。",
      detail: msg,
      code: "INTERNAL_ERROR"
    });
  }

  // === 构造前端命盘链接 ===
  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(dateStr)}&t=${hour}&g=${gender === '男' ? 'male' : 'female'}&type=solar`;

  // === 成功响应：返回完整命盘数据 ===
  const response = {
    status: "success",
    message: "紫微斗数排盘成功",
    frontend_url,
    chart_data: astrolabe // ✅ 包含 palaces（十二宫）、decadesLuck（大运）等完整结构
  };

  // === 存入缓存 ===
  CACHE.set(cacheKey, {
    timestamp: Date.now(),
    response
  });

  res.json(response);
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Ziwei API 已启动，监听端口: ${PORT}`);
});
