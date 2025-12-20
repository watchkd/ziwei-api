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
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config(); // 如果你用 .env 管理密钥

const app = express();
app.use(express.json());

// --- 配置 Google Gemini ---
// 务必确保你的环境变量里有 GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ... 这里是你原有的排盘接口 /calculate ...

// --- 新增：转发对话接口 ---
app.post('/chat', async (req, res) => {
  try {
    // 1. 接收元器传来的 prompt
    // 这里的 req.body.prompt 对应你在元器里定义的入参
    const userPrompt = req.body.prompt; 

    if (!userPrompt) {
      return res.status(400).json({ error: "请提供 prompt 参数" });
    }

    // 2. 调用 Gemini 模型
    // 使用 flash 模型速度快，pro 模型逻辑强，看你需要
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 发送请求
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    const text = response.text();

    // 3. 返回结果给元器
    // 结构要简单，方便元器读取
    res.json({
      success: true,
      data: {
        reply: text 
      }
    });

  } catch (error) {
    console.error("Gemini 调用失败:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "服务器内部错误" 
    });
  }
});

// 启动服务器
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
