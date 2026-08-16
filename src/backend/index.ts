import { Hono } from 'hono';
import { cors } from 'hono/cors';

type D1Database = any;
type Fetcher = any;

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

const ADMIN_PASSWORD = 'Tah2026@';

function cleanAddress(str?: string | null): string | null {
  if (!str) return null;
  const cleaned = str
    .replace(/,\s*,+/g, ',')
    .replace(/^\s*,+\s*/, '')
    .replace(/\s*,+\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .trim();
  return cleaned || null;
}

app.use('/api/*', cors());

// Admin Authorization Middleware — skip the /verify route itself (would deadlock)
app.use('/api/admin/*', async (c, next) => {
  // Allow the verify route to pass through unauthenticated
  if (c.req.path === '/api/admin/verify') {
    return next();
  }

  const authHeader = c.req.header('X-Admin-Password') || c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token || token !== ADMIN_PASSWORD) {
    return c.json({ error: 'Yêu cầu xác thực quản trị. Mật khẩu không chính xác.' }, 401);
  }

  await next();
});

// Helper to log audit trail
async function logAudit(db: D1Database, action: string, targetId?: string, details?: string, ip?: string) {
  try {
    await db.prepare(
      'INSERT INTO audit_logs (action, target_id, details, ip_address) VALUES (?, ?, ?, ?)'
    ).bind(action, targetId || null, details || null, ip || null).run();
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// AI Gemini & OCR Space: Parse CCCD from images with Key Rotation & Multi-Engine Fallback
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY || ''
];
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

let globalKeyIndex = 0;

function parseTextCCCD(text: string): { cccd?: string; full_name?: string; dob?: string; gender?: string; address?: string } {
  const res: { cccd?: string; full_name?: string; dob?: string; gender?: string; address?: string } = {};
  if (!text) return res;

  // 1. CCCD (12 digits starting with 0 or 9-12 digits)
  const cccdMatch = text.match(/\b(0\d{11})\b/) || text.match(/\b(\d{12})\b/);
  if (cccdMatch) {
    res.cccd = cccdMatch[1];
  }

  // 2. DOB (DD/MM/YYYY)
  const dobMatch = text.match(/(?:Ngày\s*sinh|Date\s*of\s*birth|sinh)[^\d]*(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/i)
    || text.match(/\b(\d{2})[\/\.-](\d{2})[\/\.-]((?:19|20)\d{2})\b/);
  if (dobMatch) {
    const day = dobMatch[1];
    const month = dobMatch[2];
    const year = dobMatch[3];
    res.dob = `${year}-${month}-${day}`;
  }

  // 3. Gender
  if (/Giới\s*tính[^\n]*\bNữ\b|Sex[^\n]*\bF\b/i.test(text)) {
    res.gender = 'Nữ';
  } else if (/Giới\s*tính[^\n]*\bNam\b|Sex[^\n]*\bM\b/i.test(text)) {
    res.gender = 'Nam';
  }

  // 4. Name (Uppercase line after "Họ và tên" / "Full name")
  const nameMatch = text.match(/(?:Họ\s*và\s*tên|Full\s*name)[:\s\n]+([A-ZÀÁẢẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]{4,40})/i);
  if (nameMatch) {
    const cleanName = nameMatch[1].replace(/Citizen|Identity|Card|Date|Sex|No\./gi, '').trim();
    if (cleanName.length > 2) {
      res.full_name = cleanName.toUpperCase();
    }
  }

  // Fallback Name: Find any line with ALL UPPERCASE Vietnamese words (3-5 words)
  if (!res.full_name) {
    const lines = text.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[A-ZÀÁẢẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]{5,40}$/.test(trimmed)) {
        if (!trimmed.includes('CỘNG HÒA') && !trimmed.includes('VIỆT NAM') && !trimmed.includes('CĂN CƯỚC') && !trimmed.includes('CÔNG DÂN')) {
          res.full_name = trimmed;
          break;
        }
      }
    }
  }

  // 5. Address (Text after "Nơi thường trú" / "Place of residence")
  const addrMatch = text.match(/(?:Nơi\s*thường\s*trú|Place\s*of\s*residence)[:\s\n]+([\s\S]{10,150})/i);
  if (addrMatch) {
    let rawAddr = addrMatch[1].split(/\n\n|Có\s*giá\s*trị|Date\s*of\s*expiry/i)[0];
    rawAddr = rawAddr.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (rawAddr.length > 5) {
      res.address = rawAddr;
    }
  }

  // 6. MRZ Back Card Parsing
  if (text.includes('IDVNM') || text.includes('VNM<<<<')) {
    const mrzCccd = text.match(/IDVNM(\d{12})/);
    if (mrzCccd && !res.cccd) res.cccd = mrzCccd[1];

    const mrzDob = text.match(/(\d{6})\d([MF])/);
    if (mrzDob) {
      const raw = mrzDob[1];
      const yy = parseInt(raw.substring(0, 2), 10);
      const mm = raw.substring(2, 4);
      const dd = raw.substring(4, 6);
      const year = yy > 30 ? `19${yy}` : `20${yy}`;
      if (!res.dob) res.dob = `${year}-${mm}-${dd}`;
      if (!res.gender) res.gender = mrzDob[2] === 'F' ? 'Nữ' : 'Nam';
    }

    const mrzName = text.match(/([A-Z]+<<[A-Z<]+)/);
    if (mrzName && !res.full_name) {
      res.full_name = mrzName[1].replace(/</g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  return res;
}

async function callOCRSpaceSingleImage(base64: string): Promise<string | null> {
  const ocrKeys = ['K88825134788957', 'K81729609688957', 'helloworld'];
  for (const key of ocrKeys) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    try {
      const formData = new FormData();
      formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
      formData.append('language', 'vie');
      formData.append('apikey', key);
      formData.append('isOverlayRequired', 'false');
      formData.append('OCREngine', '2');
      formData.append('scale', 'true');

      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.ok) {
        const data: any = await res.json();
        const parsedText = data?.ParsedResults?.[0]?.ParsedText;
        if (parsedText && parsedText.trim().length > 0) {
          return parsedText.trim();
        }
      }
    } catch (e) {
      clearTimeout(timer);
      console.warn('OCR Space Exception/Timeout:', e);
    }
  }
  return null;
}

function translateGeminiError(status: number, msg?: string): string {
  if (status === 429) return 'AI đang quá tải (429) — vui lòng thử lại sau ít giây.';
  if (status === 401 || status === 403) return 'API key Gemini không hợp lệ hoặc hết hạn (403).';
  if (status === 400 || status === 404) return `Lỗi mô hình AI (${status}) — đang thử mô hình khác.`;
  if (status === 500 || status === 503) return `Lỗi server AI (${status}) — thử lại sau.`;
  if (msg && msg.includes('abort')) return 'AI phản hồi quá chậm (timeout 15s).';
  return `Lỗi AI (${status || 'unknown'}): ${msg || ''}`;
}

async function tryOneGeminiRequest(
  model: string,
  apiKey: string,
  parts: any[]
): Promise<{ cccd?: string; full_name?: string; dob?: string; gender?: string; address?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      }
    );
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`Gemini model ${model} returned ${res.status}:`, errText);
      const errMsg = translateGeminiError(res.status, errText);
      throw new Error(errMsg);
    }
    const data: any = await res.json();
    const allParts: any[] = data?.candidates?.[0]?.content?.parts || [];
    let rawText = '';
    for (const part of allParts) {
      if (!part.thought && typeof part.text === 'string' && part.text.trim().length > 0) {
        rawText = part.text.trim();
        break;
      }
    }
    if (!rawText && allParts.length > 0) {
      rawText = allParts[allParts.length - 1]?.text?.trim() || '';
    }
    const jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    if (!jsonStr) throw new Error('AI không trích xuất được dữ liệu từ ảnh này.');
    let parsed: any;
    try { parsed = JSON.parse(jsonStr); } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI trả về dữ liệu không đọc được.');
      parsed = JSON.parse(match[0]);
    }
    if (!parsed || (!parsed.cccd && !parsed.full_name)) throw new Error('AI không nhận ra thông tin CCCD trong ảnh.');
    return parsed;
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('AI phản hồi quá chậm (timeout 20s). Vui lòng thử lại.');
    throw e;
  }
}

async function callGeminiSingleImage(
  img: { base64: string; mimeType: string },
  startIndex: number,
  envApiKey?: string
): Promise<{ cccd?: string; full_name?: string; dob?: string; gender?: string; address?: string } | null> {
  const keys: string[] = [];
  if (envApiKey && envApiKey.trim()) {
    const splitKeys = envApiKey.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    keys.push(...splitKeys);
  }
  for (const k of GEMINI_API_KEYS) {
    if (k.trim() && !keys.includes(k.trim())) keys.push(k.trim());
  }

  const prompt = `Bạn là trợ lý AI chuyên nghiệp đọc thông tin thẻ Căn cước công dân (CCCD) Việt Nam.
Hãy trích xuất chính xác các trường sau dưới dạng JSON:
{
  "cccd": "12 chữ số CCCD (chỉ số, không khoảng trắng)",
  "full_name": "HỌ VÀ TÊN IN HOA",
  "dob": "YYYY-MM-DD (ngày/tháng/năm sinh)",
  "gender": "Nam hoặc Nữ",
  "address": "Nơi thường trú / Quê quán đầy đủ"
}
Nếu không tìm thấy trường nào thì để chuỗi rỗng "".`;

  const parts = [
    { text: prompt },
    { inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 } }
  ];

  if (keys.length > 0) {
    for (const model of GEMINI_MODELS) {
      const raceTasks = keys.map(apiKey => tryOneGeminiRequest(model, apiKey, parts));
      try {
        const winner = await Promise.any(raceTasks);
        if (winner && (winner.cccd || winner.full_name)) return winner;
      } catch (aggErr: any) {
        console.warn(`Gemini model ${model} failed, trying next model...`);
      }
    }
  }

  // Fallback: OCR Space + Regex text parser
  const ocrText = await callOCRSpaceSingleImage(img.base64);
  if (ocrText) {
    const extracted = parseTextCCCD(ocrText);
    if (extracted.cccd || extracted.full_name) return extracted;
  }

  console.error('All AI OCR engines failed for image.');
  return null;
}

app.post('/api/ai/parse-cccd', async (c) => {
  try {
    const body = await c.req.json();
    const { images } = body as { images: { base64: string; mimeType: string }[] };

    if (!images || images.length === 0) {
      return c.json({ error: 'Cần ít nhất 1 ảnh CCCD' }, 400);
    }

    const envKey = (c.env as any)?.GEMINI_API_KEY;

    // Assign distinct starting key index for each image to rotate keys across parallel requests
    const tasks = images.map((img, idx) => {
      const startKeyIndex = (globalKeyIndex + idx);
      return callGeminiSingleImage(img, startKeyIndex, envKey);
    });

    // Rotate global key index for next incoming API request
    globalKeyIndex = (globalKeyIndex + images.length);

    // Run all image parsing tasks concurrently in parallel threads
    const results = await Promise.all(tasks);

    // Check if any result has a specific AI error to surface to the user
    const aiError = results.find((r: any) => r && r._error)?._error as string | undefined;

    // Merge extracted fields from parallel image results
    const merged = {
      cccd: '',
      full_name: '',
      dob: '',
      gender: '',
      address: ''
    };

    for (const res of results) {
      if (!res || (res as any)._error) continue;

      if (res.cccd) {
        const clean = res.cccd.replace(/\D/g, '');
        if (clean.length === 12) {
          merged.cccd = clean;
        } else if (!merged.cccd) {
          merged.cccd = clean;
        }
      }

      if (res.full_name && res.full_name.trim().length > 0 && !merged.full_name) {
        merged.full_name = res.full_name.trim().toUpperCase();
      }

      if (res.dob && res.dob.trim().length > 0 && !merged.dob) {
        merged.dob = res.dob.trim();
      }

      if (res.gender && res.gender.trim().length > 0 && !merged.gender) {
        merged.gender = res.gender.trim();
      }

      if (res.address && res.address.trim().length > 0) {
        if (!merged.address || res.address.trim().length > merged.address.length) {
          merged.address = res.address.trim();
        }
      }
    }

    if (!merged.cccd && !merged.full_name && !merged.dob && !merged.address) {
      const errMsg = aiError || 'Không thể đọc dữ liệu từ ảnh CCCD. Vui lòng chụp rõ hơn.';
      return c.json({ error: errMsg }, 422);
    }

    return c.json({ success: true, parsed: merged });
  } catch (err: any) {
    console.error('AI parse error:', err);
    return c.json({ error: err.message || 'Lỗi xử lý AI' }, 500);
  }
});

// 1. Citizen Lookup by CCCD
app.get('/api/citizens/lookup', async (c) => {
  const cccd = c.req.query('cccd')?.trim();
  if (!cccd || cccd.length < 9) {
    return c.json({ error: 'Số CCCD/CMND không hợp lệ (tối thiểu 9 số)' }, 400);
  }

  const db = c.env.DB;
  const citizen = await db.prepare('SELECT * FROM citizens WHERE cccd = ?').bind(cccd).first();

  if (!citizen) {
    return c.json({ found: false });
  }

  const records = await db.prepare(
    'SELECT * FROM health_records WHERE citizen_id = ? ORDER BY created_at DESC'
  ).bind(citizen.id).all();

  return c.json({
    found: true,
    citizen,
    history: records.results || []
  });
});

// 2. Auto-Create Account on QR Scan or CCCD Input
app.post('/api/citizens/autocreate', async (c) => {
  try {
    const {
      cccd,
      full_name,
      dob,
      gender,
      ethnicity,
      blood_type,
      bhyt,
      current_address,
      ward,
      old_address_note,
      job,
      workplace,
      guardian_name,
      phone,
      category
    } = await c.req.json();

    if (!cccd || cccd.trim().length < 9) {
      return c.json({ error: 'Số CCCD không hợp lệ (tối thiểu 9 số)' }, 400);
    }

    const db = c.env.DB;

    // Ensure old_address_note column exists
    try {
      await db.prepare('ALTER TABLE citizens ADD COLUMN old_address_note TEXT').run();
    } catch (_) {}

    let citizen = await db.prepare('SELECT * FROM citizens WHERE cccd = ?').bind(cccd.trim()).first();
    let isNew = false;

    if (!citizen) {
      isNew = true;
      const result = await db.prepare(`
        INSERT INTO citizens (
          cccd, full_name, dob, gender, ethnicity, blood_type, bhyt,
          current_address, ward, old_address_note, job, workplace, guardian_name, phone, category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        cccd.trim(),
        (full_name || '').trim().toUpperCase(),
        dob || null,
        gender || 'Nam',
        ethnicity || 'Kinh',
        blood_type || null,
        bhyt || null,
        cleanAddress(current_address),
        ward || 'Xã Tân An Hội',
        old_address_note || null,
        job || null,
        workplace || null,
        guardian_name || null,
        phone || null,
        category || 'Người lao động phi chính thức'
      ).run();

      const newId = result.meta.last_row_id;
      citizen = await db.prepare('SELECT * FROM citizens WHERE id = ?').bind(newId).first();
      await logAudit(db, 'AUTO_CREATE_CITIZEN', String(newId), `Tự động tạo tài khoản từ QR/CCCD: ${cccd}`);
    } else {
      await db.prepare(`
        UPDATE citizens SET
          full_name = COALESCE(NULLIF(?, ''), full_name),
          dob = COALESCE(NULLIF(?, ''), dob),
          gender = COALESCE(NULLIF(?, ''), gender),
          ethnicity = COALESCE(NULLIF(?, ''), ethnicity),
          blood_type = COALESCE(NULLIF(?, ''), blood_type),
          bhyt = COALESCE(NULLIF(?, ''), bhyt),
          current_address = COALESCE(NULLIF(?, ''), current_address),
          ward = COALESCE(NULLIF(?, ''), ward),
          old_address_note = COALESCE(NULLIF(?, ''), old_address_note),
          job = COALESCE(NULLIF(?, ''), job),
          workplace = COALESCE(NULLIF(?, ''), workplace),
          guardian_name = COALESCE(NULLIF(?, ''), guardian_name),
          phone = COALESCE(NULLIF(?, ''), phone),
          category = COALESCE(NULLIF(?, ''), category),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        (full_name || '').trim().toUpperCase(),
        dob || '',
        gender || '',
        ethnicity || '',
        blood_type || '',
        bhyt || '',
        cleanAddress(current_address) || '',
        ward || '',
        old_address_note || '',
        job || '',
        workplace || '',
        guardian_name || '',
        phone || '',
        category || '',
        citizen.id
      ).run();
      citizen = await db.prepare('SELECT * FROM citizens WHERE id = ?').bind(citizen.id).first();
    }

    const history = await db.prepare(
      'SELECT * FROM health_records WHERE citizen_id = ? ORDER BY created_at DESC'
    ).bind(citizen!.id).all();

    return c.json({
      success: true,
      isNew,
      citizen,
      history: history.results || []
    });
  } catch (err: any) {
    console.error('Auto create error:', err);
    return c.json({ error: err.message || 'Lỗi xử lý tạo tài khoản' }, 500);
  }
});

// 3. Submit Form (Upsert Citizen + Insert Health Record)
app.post('/api/records/submit', async (c) => {
  try {
    const body = await c.req.json();
    const {
      cccd,
      full_name,
      dob,
      gender,
      ethnicity,
      blood_type,
      bhyt,
      current_address,
      ward,
      old_address_note,
      job,
      workplace,
      guardian_name,
      phone,
      category,
      exam_type,
      screening_details,
      screening_other,
      exam_date,
      exam_location,
      exam_result,
      attachment_id,
      idempotency_key
    } = body;

    if (!cccd || cccd.length < 9) {
      return c.json({ error: 'Số CCCD/Mã định danh không hợp lệ (tối thiểu 9 số)' }, 400);
    }
    if (!full_name || full_name.trim().length === 0) {
      return c.json({ error: 'Vui lòng nhập Họ và tên người dân' }, 400);
    }

    const db = c.env.DB;

    // Ensure old_address_note column exists
    try {
      await db.prepare('ALTER TABLE citizens ADD COLUMN old_address_note TEXT').run();
    } catch (_) {}

    if (idempotency_key) {
      const existing = await db.prepare('SELECT id FROM health_records WHERE idempotency_key = ?').bind(idempotency_key).first();
      if (existing) {
        return c.json({ success: true, record_id: existing.id, duplicate: true });
      }
    }

    let citizen = await db.prepare('SELECT id FROM citizens WHERE cccd = ?').bind(cccd).first();
    let citizenId: number;

    if (citizen) {
      citizenId = citizen.id as number;
      await db.prepare(`
        UPDATE citizens SET
          full_name = ?,
          dob = ?,
          gender = ?,
          ethnicity = ?,
          blood_type = ?,
          bhyt = ?,
          current_address = ?,
          ward = ?,
          old_address_note = ?,
          job = ?,
          workplace = ?,
          guardian_name = ?,
          phone = ?,
          category = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        full_name.trim().toUpperCase(),
        dob || null,
        gender || null,
        ethnicity || 'Kinh',
        blood_type || null,
        bhyt || null,
        cleanAddress(current_address),
        ward || null,
        old_address_note || null,
        job || null,
        workplace || null,
        guardian_name || null,
        phone || null,
        category,
        citizenId
      ).run();
    } else {
      const insertResult = await db.prepare(`
        INSERT INTO citizens (
          cccd, full_name, dob, gender, ethnicity, blood_type, bhyt,
          current_address, ward, old_address_note, job, workplace, guardian_name, phone, category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        cccd.trim(),
        full_name.trim().toUpperCase(),
        dob || null,
        gender || null,
        ethnicity || 'Kinh',
        blood_type || null,
        bhyt || null,
        cleanAddress(current_address),
        ward || null,
        old_address_note || null,
        job || null,
        workplace || null,
        guardian_name || null,
        phone || null,
        category
      ).run();
      citizenId = insertResult.meta.last_row_id;
    }

    const screeningJson = Array.isArray(screening_details) ? JSON.stringify(screening_details) : JSON.stringify([]);

    // Check if an existing health record exists for this citizen
    const existingRecord = await db.prepare('SELECT id FROM health_records WHERE citizen_id = ? ORDER BY created_at DESC LIMIT 1').bind(citizenId).first();
    let recordId: number;

    if (existingRecord) {
      recordId = existingRecord.id as number;
      await db.prepare(`
        UPDATE health_records SET
          cccd = ?,
          exam_type = ?,
          screening_details = ?,
          screening_other = ?,
          exam_date = ?,
          exam_location = ?,
          exam_result = ?,
          attachment_id = COALESCE(?, attachment_id),
          created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        cccd.trim(),
        exam_type,
        screeningJson,
        screening_other || null,
        exam_date,
        exam_location,
        exam_result || null,
        attachment_id || null,
        recordId
      ).run();

      await logAudit(db, 'UPDATE_HEALTH_RECORD', String(recordId), `Cập nhật hồ sơ CCCD: ${cccd}, Tên: ${full_name}`);
    } else {
      const recResult = await db.prepare(`
        INSERT INTO health_records (
          citizen_id, cccd, exam_type, screening_details, screening_other,
          exam_date, exam_location, exam_result, attachment_id, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        citizenId,
        cccd.trim(),
        exam_type,
        screeningJson,
        screening_other || null,
        exam_date,
        exam_location,
        exam_result || null,
        attachment_id || null,
        idempotency_key || null
      ).run();
      recordId = recResult.meta.last_row_id as number;

      await logAudit(db, 'SUBMIT_HEALTH_RECORD', String(recordId), `Tạo mới hồ sơ CCCD: ${cccd}, Tên: ${full_name}`);
    }

    return c.json({
      success: true,
      citizen_id: citizenId,
      record_id: recordId,
      updated: !!existingRecord
    });
  } catch (err: any) {
    console.error('Submit error:', err);
    return c.json({ error: err.message || 'Lỗi server khi lưu thông tin' }, 500);
  }
});

// 4. Upload Attachment
app.post('/api/attachments/upload', async (c) => {
  try {
    const { filename, mime_type, data_base64 } = await c.req.json();
    if (!data_base64) {
      return c.json({ error: 'Không có dữ liệu file' }, 400);
    }

    const id = 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const db = c.env.DB;
    const fileSize = Math.round((data_base64.length * 3) / 4);

    await db.prepare(
      'INSERT INTO attachments (id, filename, mime_type, data_base64, file_size) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, filename || 'file.webp', mime_type || 'image/webp', data_base64, fileSize).run();

    return c.json({ success: true, id, file_size: fileSize });
  } catch (err: any) {
    console.error('Upload error:', err);
    return c.json({ error: 'Lỗi tải ảnh lên' }, 500);
  }
});

// 5. Get Attachment
app.get('/api/attachments/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const att = await db.prepare('SELECT * FROM attachments WHERE id = ?').bind(id).first();

  if (!att) {
    return c.text('Attachment not found', 404);
  }

  const base64Data = att.data_base64 as string;
  const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const binaryString = atob(pureBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Response(bytes, {
    headers: {
      'Content-Type': (att.mime_type as string) || 'image/webp',
      'Cache-Control': 'public, max-age=86400'
    }
  });
});

// 6. Admin Verify Password Route
app.post('/api/admin/verify', async (c) => {
  const { password } = await c.req.json();
  if (password === ADMIN_PASSWORD) {
    return c.json({ success: true, token: ADMIN_PASSWORD });
  }
  return c.json({ error: 'Mật khẩu quản trị không chính xác' }, 401);
});

// 7a. Admin: Re-sequence IDs (renumber citizens and health_records sequentially by created_at)
app.post('/api/admin/resequence', async (c) => {
  try {
    const db = c.env.DB;

    // Get all citizen IDs ordered by created_at (the correct order)
    const citizenRows = (await db.prepare(
      'SELECT id FROM citizens ORDER BY created_at ASC, id ASC'
    ).all()).results as { id: number }[];

    // Get all health_record IDs ordered by created_at
    const recordRows = (await db.prepare(
      'SELECT id FROM health_records ORDER BY created_at ASC, id ASC'
    ).all()).results as { id: number }[];

    if (citizenRows.length === 0 && recordRows.length === 0) {
      return c.json({ success: true, message: 'Không có dữ liệu để xếp lại.' });
    }

    const OFFSET = 1_000_000; // temp offset to avoid PK conflicts during renumber

    // ---- Phase 1: Shift all citizen IDs to large negative space ----
    const phase1Citizens = citizenRows.map(r =>
      db.prepare('UPDATE citizens SET id = ? WHERE id = ?').bind(r.id + OFFSET, r.id)
    );
    // Also shift citizen_id FK in health_records
    const phase1RecordFK = citizenRows.map(r =>
      db.prepare('UPDATE health_records SET citizen_id = ? WHERE citizen_id = ?')
        .bind(r.id + OFFSET, r.id)
    );

    // ---- Phase 2: Assign new sequential IDs to citizens ----
    const phase2Citizens = citizenRows.map((r, i) =>
      db.prepare('UPDATE citizens SET id = ? WHERE id = ?').bind(i + 1, r.id + OFFSET)
    );
    // Update FK references to match new citizen IDs
    const phase2RecordFK = citizenRows.map((r, i) =>
      db.prepare('UPDATE health_records SET citizen_id = ? WHERE citizen_id = ?')
        .bind(i + 1, r.id + OFFSET)
    );

    // ---- Phase 3: Shift all health_record IDs to large offset ----
    const phase3Records = recordRows.map(r =>
      db.prepare('UPDATE health_records SET id = ? WHERE id = ?').bind(r.id + OFFSET, r.id)
    );

    // ---- Phase 4: Assign new sequential IDs to health_records ----
    const phase4Records = recordRows.map((r, i) =>
      db.prepare('UPDATE health_records SET id = ? WHERE id = ?').bind(i + 1, r.id + OFFSET)
    );

    // ---- Phase 5: Reset autoincrement counters ----
    const resetSeq = [
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'citizens'"),
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'health_records'"),
    ];

    // Execute all phases in batches of 50 (D1 limit)
    const chunkBatch = async (stmts: any[]) => {
      for (let i = 0; i < stmts.length; i += 50) {
        await db.batch(stmts.slice(i, i + 50));
      }
    };

    await chunkBatch([...phase1Citizens, ...phase1RecordFK]);
    await chunkBatch([...phase2Citizens, ...phase2RecordFK]);
    await chunkBatch(phase3Records);
    await chunkBatch(phase4Records);
    await db.batch(resetSeq);

    await logAudit(db, 'ADMIN_RESEQUENCE', undefined,
      `Đã xếp lại ${citizenRows.length} dân / ${recordRows.length} hồ sơ`);

    return c.json({
      success: true,
      citizens_renumbered: citizenRows.length,
      records_renumbered: recordRows.length,
      message: `Đã xếp lại ${citizenRows.length} công dân và ${recordRows.length} hồ sơ sức khỏe.`
    });
  } catch (err: any) {
    console.error('Resequence error:', err);
    return c.json({ error: err.message || 'Lỗi xếp lại thứ tự ID' }, 500);
  }
});

// Admin: Update citizen + health record
app.put('/api/admin/citizens/:id', async (c) => {
  try {
    const db = c.env.DB;
    const citizenId = parseInt(c.req.param('id'));
    if (!citizenId) return c.json({ error: 'ID không hợp lệ' }, 400);

    const body = await c.req.json();
    const {
      phone, job, workplace, guardian_name, ethnicity, blood_type, bhyt, category,
      exam_type, exam_date, exam_location, exam_result, screening_details, screening_other
    } = body;

    // Update citizen fields
    await db.prepare(`
      UPDATE citizens SET
        phone = COALESCE(?, phone),
        job = COALESCE(?, job),
        workplace = COALESCE(?, workplace),
        guardian_name = COALESCE(?, guardian_name),
        ethnicity = COALESCE(?, ethnicity),
        blood_type = COALESCE(?, blood_type),
        bhyt = COALESCE(?, bhyt),
        category = COALESCE(?, category)
      WHERE id = ?
    `).bind(
      phone ?? null, job ?? null, workplace ?? null, guardian_name ?? null,
      ethnicity ?? null, blood_type ?? null, bhyt ?? null, category ?? null,
      citizenId
    ).run();

    // Update most recent health record if exam fields provided
    if (exam_type !== undefined || exam_date !== undefined || exam_result !== undefined) {
      const rec = await db.prepare(
        'SELECT id FROM health_records WHERE citizen_id = ? ORDER BY created_at DESC LIMIT 1'
      ).bind(citizenId).first() as any;

      if (rec) {
        await db.prepare(`
          UPDATE health_records SET
            exam_type = COALESCE(?, exam_type),
            exam_date = COALESCE(?, exam_date),
            exam_location = COALESCE(?, exam_location),
            exam_result = COALESCE(?, exam_result),
            screening_details = COALESCE(?, screening_details),
            screening_other = COALESCE(?, screening_other)
          WHERE id = ?
        `).bind(
          exam_type ?? null, exam_date ?? null, exam_location ?? null,
          exam_result ?? null,
          screening_details ? JSON.stringify(screening_details) : null,
          screening_other ?? null,
          rec.id
        ).run();
      }
    }

    await logAudit(db, 'ADMIN_UPDATE_CITIZEN', String(citizenId), `Cập nhật thông tin công dân #${citizenId}`);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message || 'Lỗi cập nhật' }, 500);
  }
});

// 7. Admin List Records (Protected by Middleware)
app.get('/api/admin/records', async (c) => {
  try {
    const db = c.env.DB;
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 10000);
    const offset = (page - 1) * limit;

    const search = c.req.query('search')?.trim();
    const ward = c.req.query('ward')?.trim();
    const category = c.req.query('category')?.trim();
    const exam_type = c.req.query('exam_type')?.trim();
    const date_from = c.req.query('date_from')?.trim();
    const date_to = c.req.query('date_to')?.trim();

    // Ensure required columns exist in citizens table
    try {
      await db.prepare('ALTER TABLE citizens ADD COLUMN deleted_at DATETIME').run();
    } catch (_) {}
    try {
      await db.prepare('ALTER TABLE citizens ADD COLUMN old_address_note TEXT').run();
    } catch (_) {}

    // exam_type filter: only filter if a record exists
    let whereClause = 'WHERE (c.deleted_at IS NULL)';
    const params: any[] = [];

    if (search) {
      const cleanSearch = search.replace(/^#/, '').trim();
      whereClause += ' AND (c.cccd LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR CAST(r.id AS TEXT) LIKE ? OR CAST(c.id AS TEXT) LIKE ?)';
      const s = `%${cleanSearch}%`;
      params.push(s, s, s, s, s);
    }
    if (ward) {
      whereClause += ' AND c.ward = ?';
      params.push(ward);
    }
    if (category) {
      whereClause += ' AND c.category = ?';
      params.push(category);
    }
    if (exam_type) {
      whereClause += ' AND r.exam_type = ?';
      params.push(exam_type);
    }
    if (date_from) {
      whereClause += ' AND r.exam_date >= ?';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND r.exam_date <= ?';
      params.push(date_to);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM citizens c
      LEFT JOIN health_records r ON r.id = (SELECT id FROM health_records WHERE citizen_id = c.id ORDER BY created_at DESC LIMIT 1)
      ${whereClause}
    `;
    const totalRow = await db.prepare(countQuery).bind(...params).first();
    const total = (totalRow?.total as number) || 0;

    const dataQuery = `
      SELECT 
        r.id as record_id,
        COALESCE(r.cccd, c.cccd) as cccd,
        r.exam_type,
        r.screening_details,
        r.screening_other,
        r.exam_date,
        r.exam_location,
        r.exam_result,
        r.attachment_id,
        COALESCE(r.created_at, c.updated_at, c.created_at) as record_created_at,
        c.id as citizen_id,
        c.full_name,
        c.dob,
        c.gender,
        c.ethnicity,
        c.blood_type,
        c.bhyt,
        c.current_address,
        c.ward,
        c.old_address_note,
        c.job,
        c.workplace,
        c.guardian_name,
        c.phone,
        c.category,
        c.created_at as citizen_created_at
      FROM citizens c
      LEFT JOIN health_records r ON r.id = (SELECT id FROM health_records WHERE citizen_id = c.id ORDER BY created_at DESC LIMIT 1)
      ${whereClause}
      ORDER BY COALESCE(r.created_at, c.updated_at, c.created_at) DESC, c.id DESC
      LIMIT ? OFFSET ?
    `;

    const records = await db.prepare(dataQuery).bind(...params, limit, offset).all();

    return c.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: records.results || []
    });
  } catch (err: any) {
    console.error('Admin records query error:', err);
    return c.json({ error: err.message || 'Lỗi truy vấn dữ liệu' }, 500);
  }
});

// 8. Admin Trash Bin List
app.get('/api/admin/trash', async (c) => {
  try {
    const db = c.env.DB;
    try { await db.prepare('ALTER TABLE citizens ADD COLUMN deleted_at DATETIME').run(); } catch (_) {}

    const records = await db.prepare(`
      SELECT 
        r.id as record_id,
        COALESCE(r.cccd, c.cccd) as cccd,
        r.exam_type,
        r.screening_details,
        r.screening_other,
        r.exam_date,
        r.exam_location,
        r.exam_result,
        r.attachment_id,
        c.id as citizen_id,
        c.full_name,
        c.dob,
        c.gender,
        c.phone,
        c.category,
        c.deleted_at
      FROM citizens c
      LEFT JOIN health_records r ON r.id = (SELECT id FROM health_records WHERE citizen_id = c.id ORDER BY created_at DESC LIMIT 1)
      WHERE c.deleted_at IS NOT NULL
      ORDER BY c.deleted_at DESC
    `).all();

    return c.json({
      total: records.results?.length || 0,
      data: records.results || []
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 9. Admin Analytics Stats (Protected by Middleware)
app.get('/api/admin/stats', async (c) => {
  try {
    const db = c.env.DB;
    try { await db.prepare('ALTER TABLE citizens ADD COLUMN deleted_at DATETIME').run(); } catch (_) {}

    const totalCitizensRow = await db.prepare('SELECT COUNT(*) as count FROM citizens WHERE deleted_at IS NULL').first();
    const totalRecordsRow = await db.prepare('SELECT COUNT(*) as count FROM health_records r JOIN citizens c ON r.citizen_id = c.id WHERE c.deleted_at IS NULL').first();
    const trashCountRow = await db.prepare('SELECT COUNT(*) as count FROM citizens WHERE deleted_at IS NOT NULL').first();

    const categoryStats = await db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM citizens 
      WHERE deleted_at IS NULL
      GROUP BY category
    `).all();

    const examTypeStats = await db.prepare(`
      SELECT r.exam_type, COUNT(*) as count 
      FROM health_records r
      JOIN citizens c ON r.citizen_id = c.id
      WHERE c.deleted_at IS NULL
      GROUP BY r.exam_type
    `).all();

    const wardStats = await db.prepare(`
      SELECT ward, COUNT(*) as count 
      FROM citizens 
      WHERE ward IS NOT NULL AND ward != '' AND deleted_at IS NULL
      GROUP BY ward
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return c.json({
      totalCitizens: totalCitizensRow?.count || 0,
      totalRecords: totalRecordsRow?.count || 0,
      trashCount: trashCountRow?.count || 0,
      byCategory: categoryStats.results || [],
      byExamType: examTypeStats.results || [],
      byWard: wardStats.results || []
    });
  } catch (err: any) {
    console.error('Admin stats error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// 10. Soft Delete Citizen (Move to Trash)
app.delete('/api/admin/citizens/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  try { await db.prepare('ALTER TABLE citizens ADD COLUMN deleted_at DATETIME').run(); } catch (_) {}
  await db.prepare('UPDATE citizens SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run();
  await logAudit(db, 'SOFT_DELETE_CITIZEN', id, 'Chuyển hồ sơ vào Thùng rác');
  return c.json({ success: true });
});

// 11. Bulk Soft Delete Citizens (Move to Trash)
app.post('/api/admin/citizens/bulk-delete', async (c) => {
  const { ids } = await c.req.json<{ ids: number[] }>();
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: 'Danh sách ID không hợp lệ' }, 400);
  }
  const db = c.env.DB;
  try { await db.prepare('ALTER TABLE citizens ADD COLUMN deleted_at DATETIME').run(); } catch (_) {}
  const placeholders = ids.map(() => '?').join(',');
  await db.prepare(`UPDATE citizens SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).bind(...ids).run();
  await logAudit(db, 'BULK_SOFT_DELETE', '', `Chuyển ${ids.length} hồ sơ vào Thùng rác`);
  return c.json({ success: true, count: ids.length });
});

// 12. Restore Citizen from Trash
app.post('/api/admin/citizens/:id/restore', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('UPDATE citizens SET deleted_at = NULL WHERE id = ?').bind(id).run();
  await logAudit(db, 'RESTORE_CITIZEN', id, 'Khôi phục hồ sơ từ Thùng rác');
  return c.json({ success: true });
});

// 13. Permanent Delete Citizen (Really delete from database)
app.delete('/api/admin/citizens/:id/permanent', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM health_records WHERE citizen_id = ?').bind(id).run();
  await db.prepare('DELETE FROM citizens WHERE id = ?').bind(id).run();
  await logAudit(db, 'PERMANENT_DELETE_CITIZEN', id, 'Xóa vĩnh viễn hồ sơ khỏi hệ thống');
  return c.json({ success: true });
});

// 14. Empty Trash (Permanently delete all in trash)
app.post('/api/admin/trash/empty', async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM health_records WHERE citizen_id IN (SELECT id FROM citizens WHERE deleted_at IS NOT NULL)').run();
  await db.prepare('DELETE FROM citizens WHERE deleted_at IS NOT NULL').run();
  await logAudit(db, 'EMPTY_TRASH', '', 'Dọn dẹp dọn sạch Thùng rác');
  return c.json({ success: true });
});

// SPA Fallback Route for non-API requests (e.g. /manage)
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;

