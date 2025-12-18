const express = require('express');
const { astro } = require('iztro');
const cors = require('cors');

const app = express();

// 启用 CORS 和 JSON body 解析
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * 健康检查接口（用于 Zeabur 探活）
 */
app.get('/', (req, res) => {
  res.status(200).send('Ziwei API is running!');
});

/**
 * 紫微斗数排盘接口
 * 
 * 请求示例:
 * POST /calculate
 * {
 *   "dateStr": "2000-01-01",
 *   "timeIndex": 12,
 *   "gender": "男"
 * }
 */
app.post('/calculate', (req, res) => {
  try {
    const { dateStr, timeIndex, gender } = req.body;

    // 1. 必填参数校验
    if (!dateStr || timeIndex === undefined || !gender) {
      return res.status(400).json({
        error: "缺少必要参数",
        required: ["dateStr (YYYY-MM-DD)", "timeIndex (0-23)", "gender (男/女)"]
      });
    }

    // 2. 性别校验
    if (gender !== '男' && gender !== '女') {
      return res.status(400).json({
        error: "性别必须是 '男' 或 '女'"
      });
    }

    // 3. 小时值校验（关键！防止 iztro 报错）
    const hour = Number(timeIndex);
    if (isNaN(hour) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      return res.status(400).json({
        error: `出生小时必须是 0-23 的整数，当前值: ${timeIndex}`
      });
    }

    // 4. 日期格式简单校验（YYYY-MM-DD）
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return res.status(400).json({
        error: "日期格式错误，请使用 YYYY-MM-DD 格式，例如 2000-01-01"
      });
    }

    // 5. 调用 iztro 排盘（阳历）
    let astrolabe;
    try {
      astrolabe = astro.bySolar(dateStr, hour, gender, false, 'zh-CN');
    } catch (e) {
      // 捕获 iztro 内部错误（如非法日期：2月30日）
      return res.status(400).json({
        error: "排盘失败，请检查日期是否合法（如月份≤12，日期≤当月天数）",
        detail: e.message
      });
    }

    // 6. 构造前端查看链接
    const frontend_url = `https://ziwei.pub/astrolabe/?d=${astrolabe.solarDate}&t=${astrolabe.timeIndex}&g=${astrolabe.gender === '男' ? 'male' : 'female'}&type=solar`;

    // 7. 返回结构化结果（便于 AI 解读）
    res.status(200).json({
      status: "success",
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

  } catch (e) {
    console.error('Unexpected error:', e);
    res.status(500).json({
      error: "服务器内部错误",
      message: e.message
    });
  }
});

// 启动服务（兼容 Zeabur 的 PORT 环境变量）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Ziwei API 服务已启动，监听端口: ${PORT}`);
});
