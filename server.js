app.post('/calculate', (req, res) => {
  const { dateStr, timeIndex, gender } = req.body;

  // 1. 参数校验（略，保持不变）

  const hour = Number(timeIndex);
  if (isNaN(hour) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
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
      error: "日期格式错误，请使用 YYYY-MM-DD 格式",
      code: "INVALID_DATE_FORMAT"
    });
  }

  if (gender !== '男' && gender !== '女') {
    return res.json({
      status: "error",
      error: "性别必须是 '男' 或 '女'",
      code: "INVALID_GENDER"
    });
  }

  // 2. 排盘（关键：useZone = true）
  let astrolabe;
  try {
    astrolabe = astro.bySolar(dateStr, hour, gender, true, 'zh-CN'); // ✅ 禁用时区修正
  } catch (e) {
    const msg = e.message || '';
    if (msg.startsWith('wrong hour')) {
      return res.json({
        status: "error",
        error: `出生小时无效：${msg.replace('wrong hour ', '')}。请确保为 0-23 整数。`,
        detail: msg,
        code: "INVALID_HOUR"
      });
    }
    return res.json({
      status: "error",
      error: "排盘失败，请检查日期是否合法。",
      detail: msg,
      code: "CALCULATION_FAILED"
    });
  }

  // 3. 找到命宫（直接使用 palaces 中的数据）
  const mingPalace = astrolabe.palaces.find(p => p.name === '命宫');
  if (!mingPalace) {
    return res.json({
      status: "error",
      error: "未找到命宫",
      code: "MISSING_MING_PALACE"
    });
  }

  // 4. 构造前端 URL（✅ 使用原始 hour，不是 astrolabe.timeIndex）
  const frontend_url = `https://ziwei.pub/astrolabe/?d=${encodeURIComponent(dateStr)}&t=${hour}&g=${gender === '男' ? 'male' : 'female'}&type=solar`;

  // 5. 返回结果
  res.json({
    status: "success",
    message: "紫微排盘成功",
    frontend_url,
    data: {
      gender: astrolabe.gender,
      solarDate: astrolabe.solarDate,
      chineseZodiac: astrolabe.chineseZodiac,
      fiveElements: astrolabe.fiveElementsClass,
      lifePalaceBranch: astrolabe.lifePalaceBranch,
      ming_palace: mingPalace // ✅ 直接使用，已包含完整 minorStars
    }
  });
});
