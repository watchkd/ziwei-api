const express = require('express');
const { astro } = require('iztro');
const cors = require('cors');

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * 健康检查接口（Zeabur 探活）
 */
app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

/**
 * 紫微斗数排盘接口
 *
 * 参数说明：
 * - dateStr: 字符串，格式 YYYY-MM-DD（如 "1990-05-20"）
 * - timeIndex: 数字或字符串，**实际代表出生小时（0-23）**，例如：
 *     凌晨0点 → 0
 *     上午9点 → 9
 *     下午1点 → 13
 *     晚上11点 → 23
 * - gender: "男" 或 "女"
 *
 * 注意：虽然参数名是 timeIndex，但语义是 hour（为兼容某些平台命名限制）
 */
app.post('/calculate', (req, res) => {
  const { dateStr, timeIndex, gender } = req.body;

  // === 1. 必填校验 ===
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

  // === 3. 小时解析与校验（timeIndex 实际是 hour）===
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

  if (
    isNaN(hour) ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    return res.status(400).json({
      status: "error",
      error: `出生小时无效：必须是 0-23 的整数，当前值: ${timeIndex}`,
      code: "INVALID_HOUR_RANGE"
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

  // === 5. 调用 iztro 排盘 ===
  let astrolabe;
  try {
    // 第4个参数 true：禁用真太阳时修正，使用原始 hour
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

  // === 6. 提取命宫 ===
  const mingPalace = astrolabe.palaces.find(p => p.name === '命宫');
  if (!mingPalace) {
    return res.status(500).json({
      status: "error",
      error: "排盘结果中未找到命宫",
      code: "MISSING_MING_PALACE"
    });
  }

  // === 7. 构造前端链接 ===
  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(dateStr)}&t=${hour}&g=${gender === '男' ? 'male' : 'female'}&type=solar`;

  // === 8. 成功响应 ===
  res.status(200).json({
    status: "success",
    message: "紫微斗数排盘成功",
    frontend_url,
    data: {
      gender: astrolabe.gender,
      solarDate: astrolabe.solarDate,
      lunarDate: astrolabe.lunarDate,
      chineseZodiac: astrolabe.chineseZodiac,
      fiveElements: astrolabe.fiveElementsClass,
      lifePalaceBranch: astrolabe.lifePalaceBranch,
      ming_palace: {
        name: mingPalace.name,
        majorStars: mingPalace.majorStars,
        minorStars: mingPalace.minorStars,
        adjectiveStars: mingPalace.adjectiveStars
      }
    }
  });
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Ziwei API 已启动，监听端口: ${PORT}`);
});
