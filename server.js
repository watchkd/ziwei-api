// ... 其他不变 ...

// === 3. timeIndex 解析与校验 ===
let parsedTimeIndex;
if (typeof timeIndex === 'number') {
  if (!Number.isInteger(timeIndex)) {
    return res.status(400).json({
      status: "error",
      error: "timeIndex 必须是整数",
      code: "INVALID_TIME_INDEX"
    });
  }
  parsedTimeIndex = timeIndex;
} else if (typeof timeIndex === 'string') {
  const trimmed = timeIndex.trim();
  if (trimmed === '') {
    return res.status(400).json({
      status: "error",
      error: "timeIndex 不能为空",
      code: "INVALID_TIME_INDEX"
    });
  }
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 0 || num > 12) {
    return res.status(400).json({
      status: "error",
      error: "timeIndex 必须是 0-12 的整数",
      code: "INVALID_TIME_INDEX"
    });
  }
  parsedTimeIndex = num;
} else {
  return res.status(400).json({
    status: "error",
    error: "timeIndex 类型无效",
    code: "INVALID_TIME_INDEX"
  });
}

// === 5. 确定实际排盘日期和小时 ===
let actualDate = dateStr;
let hourForIztro;

if (parsedTimeIndex === 12) {
  try {
    actualDate = addOneDay(dateStr);
  } catch (e) {
    return res.status(400).json({
      status: "error",
      error: "无法计算次日日期",
      code: "DATE_CALCULATION_ERROR"
    });
  }
  hourForIztro = 0;
} else {
  hourForIztro = TIME_INDEX_TO_HOUR[parsedTimeIndex];
  if (hourForIztro === undefined) {
    return res.status(500).json({
      status: "error",
      error: "时辰索引映射失败",
      code: "HOUR_MAPPING_ERROR"
    });
  }
}

// === 7. 调用 iztro ===
try {
  astrolabe = astro.bySolar(actualDate, hourForIztro, gender, true, 'zh-CN');
} catch (e) {
  console.error('❌ 排盘失败:', e.message);
  return res.status(400).json({
    status: "error",
    error: `小时值 ${hourForIztro} 无效（应为 0-23）`,
    code: "IZTRO_HOUR_ERROR"
  });
}
