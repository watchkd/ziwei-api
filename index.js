import express from 'express';
import cors from 'cors';
import { astro } from 'iztro';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- 调试中间件：打印所有进来的请求 ---
app.use((req, res, next) => {
  console.log(`收到请求: ${req.method} ${req.url}`);
  next();
});

// --- 根路由：用来验证版本 ---
app.get('/', (req, res) => {
  // 注意看这里，我加了【新版验证】这几个字
  res.send('【新版验证成功】紫微斗数 API 已更新！如果你看到这句话，说明代码没问题。');
});

// --- 核心计算接口 ---
app.post('/calculate', (req, res) => {
  console.log('正在处理 POST /calculate 请求...'); // 日志标记
  try {
    // 兼容 query 和 body 参数
    const params = { ...req.query, ...req.body };
    const { date, timeIndex, gender, type = 'solar', fixLeap, isLeapMonth } = params;

    if (!date || timeIndex === undefined || !gender) {
      return res.status(400).json({ error: '参数缺失: date, timeIndex, gender' });
    }

    let astrolabe;
    if (type === 'lunar') {
      astrolabe = astro.byLunar(date, Number(timeIndex), gender, isLeapMonth === true, fixLeap !== 'false', 'zh-CN');
    } else {
      astrolabe = astro.bySolar(date, Number(timeIndex), gender, fixLeap !== 'false', 'zh-CN');
    }
    
    res.json({ success: true, data: astrolabe });
  } catch (error) {
    console.error('计算出错:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
