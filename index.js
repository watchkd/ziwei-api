import express from 'express';
import cors from 'cors';
import { astro } from 'iztro';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// 支持 JSON 格式 (application/json)
app.use(express.json());
// 支持 表单 格式 (application/x-www-form-urlencoded) -> 这很重要！
app.use(express.urlencoded({ extended: true }));

// 首页
app.get('/', (req, res) => {
  res.send('API 准备就绪。请通过 POST /calculate 调用。');
});

app.post('/calculate', (req, res) => {
  // --- 关键日志：打印收到的所有数据，帮你看清插件传了什么 ---
  console.log('--- 收到新请求 ---');
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body数据:', JSON.stringify(req.body));
  console.log('Query数据:', JSON.stringify(req.query));
  // -----------------------------------------------------

  try {
    // 混合获取参数，无论插件放在 Body 还是 Query 都能读到
    const params = { ...req.query, ...req.body };
    const { date, timeIndex, gender, type = 'solar', fixLeap, isLeapMonth } = params;

    // 严谨的检查
    if (!date || timeIndex === undefined || !gender) {
      console.log('失败：参数缺失'); // 打印失败原因
      return res.status(400).json({ 
        error: '参数缺失: date, timeIndex, gender',
        received: params // 把收到的东西返回给你看，方便调试
      });
    }

    let astrolabe;
    // 核心计算逻辑
    if (type === 'lunar') {
      astrolabe = astro.byLunar(date, Number(timeIndex), gender, isLeapMonth === 'true', fixLeap !== 'false', 'zh-CN');
    } else {
      astrolabe = astro.bySolar(date, Number(timeIndex), gender, fixLeap !== 'false', 'zh-CN');
    }

    console.log('成功：计算完成');
    res.json({ success: true, data: astrolabe });

  } catch (error) {
    console.error('系统错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
