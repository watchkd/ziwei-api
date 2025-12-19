import express from 'express';
import cors from 'cors';
import { astro } from 'iztro';

const app = express();
const port = process.env.PORT || 3000;

// 允许跨域请求，方便以后你从网页调用
app.use(cors());
app.use(express.json());

// 根路由：简单的欢迎信息
app.get('/', (req, res) => {
  res.send('紫微斗数 API 已启动。请访问 /api/solar 或 /api/lunar 进行排盘。');
});

/**
 * [...](asc_slot://start-slot-3)阳历排盘接口
 * 请求方式: GET
 * 参数:
 *  - date: 阳历日期，格式 YYYY-M-D (例如: 2000-8-16)
 *  - timeIndex: 时辰索引 (0-12) [0:早子, 1:丑, ..., 12:晚子]
 *  - gender: 性别 (男/女)
 *  - fixLeap: 是否修正闰月 (true/false) - 默认 true
 * 
 * [...](asc_slot://start-slot-5)示例: /api/solar?date=2000-8-16&timeIndex=2&gender=女
 */
app.get('/api/solar', (req, res) => {
  try {
    const { date, timeIndex, gender, fixLeap } = req.query;

    if (!date || timeIndex === undefined || !gender) {
      return res.status(400).json({ error: '缺少必要参数: date, timeIndex, gender' });
    }

    [...](asc_slot://start-slot-7)const astrolabe = astro.bySolar(
      date, 
      Number(timeIndex), 
      gender, 
      fixLeap === 'false' ? false : true, 
      'zh-CN'
    );

    res.json({
      success: true,
      data: astrolabe
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 农历排盘接口
 * 参数:
 *  - date: 农历日期，格式 YYYY-M-D
 *  - timeIndex: 时辰索引 (0-12)
 *  - gender: 性别 (男/女)
 *  - isLeapMonth: 是否是闰月 (true/false)
 *  [...](asc_slot://start-slot-9)- fixLeap: 是否修正闰月 (true/false)
 */
app.get('/api/lunar', (req, res) => {
  try {
    const { date, timeIndex, gender, isLeapMonth, fixLeap } = req.query;

    if (!date || timeIndex === undefined || !gender) {
      return res.status(400).json({ error: '缺少必要参数: date, timeIndex, gender' });
    }

    const astrolabe = astro.byLunar(
      date, 
      Number(timeIndex), 
      gender, 
      isLeapMonth === 'true', 
      fixLeap === 'false' ? false : true, 
      'zh-CN'
    );

    res.json({
      success: true,
      data: astrolabe
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
