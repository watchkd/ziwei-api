const express = require('express');
const { astro } = require('iztro');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// 核心排盘 API
app.post('/calculate', (req, res) => {
    try {
        const { dateStr, timeIndex, gender } = req.body;
        
        // 简单的参数校验
        if (!dateStr || timeIndex === undefined || !gender) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // 运行 iztro 排盘
        const astrolabe = astro.bySolar(dateStr, parseInt(timeIndex), gender, false, 'zh-CN');
        
        // 生成前端查看链接
        const frontend_url = `https://ziwei.pub/astrolabe/?d=${astrolabe.solarDate}&t=${astrolabe.timeIndex}&g=${astrolabe.gender === '男' ? 'male' : 'female'}&type=solar`;

        res.json({
            status: "success",
            frontend_url: frontend_url,
            data: {
                 gender: astrolabe.gender,
                 solarDate: astrolabe.solarDate,
                 fiveElements: astrolabe.fiveElementsClass,
                 chineseZodiac: astrolabe.chineseZodiac,
                 // 提取命宫信息供 AI 解读
                 ming_palace: astrolabe.palaces.find(p => p.name === '命宫')
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 健康检查接口（Zeabur 用来判断服务是否活着）
app.get('/', (req, res) => {
    res.send('Ziwei API is running!');
});

// 关键：读取环境变量中的 PORT，如果没有则默认为 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
