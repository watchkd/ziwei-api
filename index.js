import express from 'express';
import cors from 'cors';
import { astro } from 'iztro';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('紫微斗数 API 运行中。尝试访问 /api/solar?date=2000-8-16&timeIndex=2&gender=女');
});
app.get('/api/solar', (req, res) => {
  try {
    const { date, timeIndex, gender, fixLeap } = req.query;
    if (!date || timeIndex === undefined || !gender) {
      return res.status(400).json({ error: '参数缺失: 请提供 date, timeIndex, gender' });
    }
    const astrolabe = astro.bySolar(date, Number(timeIndex), gender, fixLeap !== 'false', 'zh-CN');
    res.json({ success: true, data: astrolabe });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/lunar', (req, res) => {
  try {
    const { date, timeIndex, gender, isLeapMonth, fixLeap } = req.query;
    if (!date || timeIndex === undefined || !gender) {
      return res.status(400).json({ error: '参数缺失: 请提供 date, timeIndex, gender' });
    }
    const astrolabe = astro.byLunar(date, Number(timeIndex), gender, isLeapMonth === 'true', fixLeap !== 'false', 'zh-CN');
    res.json({ success: true, data: astrolabe });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Service started on port ${port}`);
});
