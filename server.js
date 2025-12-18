const express = require('express');
const { astro } = require('iztro');
const cors = require('cors');

const app = express();

// 启用 CORS（允许百炼等平台跨域调用）
app.use(cors());

// 解析 JSON 请求体，限制 1MB 防止滥用
app.use(express.json({ limit: '1mb' }));

/**
 * 健康检查接口 - Zeabur 用于判断服务是否存活
 */
app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

/**
 * 紫微斗数排盘接口
 * 
 * 注意：始终返回 HTTP 200，业务状态通过 JSON 中的 status 字段表示
 * 这是避免阿里百炼报 "InvokePluginError" 的关键！
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

  // 3. 小时值校验（防止 iztro 抛出 "wrong hour XX"）
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
      error: "日期格式错误，请使用 YYYY-MM-DD 格式（如 1990-05-20）",
      code: "INVALID_DATE_FORMAT"
    });
  }

  // 5. 调用 iztro 排盘（阳历）
  let astrolabe;
  try {
    astrolabe = astro.bySolar(dateStr, hour, gender, false, 'zh-CN');
  } catch (e) {
    // 捕获非法日期（如 2023-02-30）或内部错误
    return res.json({
      status: "error",
      error: "排盘失败，请检查日期是否合法（如月份≤12，日期≤当月天数）",
      detail: e.message,
      code: "CALCULATION_FAILED"
    });
  }

  // 6. 构造前端命盘查看链接
  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(astrolabe.solarDate)}&t=${astrolabe.timeIndex}&g=${astrolabe.gender === '男' ? 'male' : 'female'}&type=solar`;

  // 7. 成功响应（status: "success"）
  res.json({
    status: "success",
    message: "排盘成功",
    frontend_url,
    data: {
      gender: astrolabe.gender,
      solarDate: astrolabe.solarDate,
      chineseZodiac: astrolabe.chineseZodiac,      // 生肖
      fiveElements: astrolabe.fiveElementsClass,   // 五行局
      lifePalaceBranch: astrolabe.lifePalaceBranch, // 命宫地支
      ming_palace: astrolabe.palaces.find(p => p.name === '命宫') || null
    }
  });
});

// 启动服务（兼容 Zeabur / 阿里云 FC / 本地开发）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Ziwei API 服务已启动，监听端口: ${PORT}`);
});
