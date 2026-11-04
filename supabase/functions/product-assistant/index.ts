import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type ChatMessage = { role: "user" | "model"; content: string };
type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  category: { name: string } | null;
  image_url: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function getPublishableKey() {
  const keyMap = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keyMap) {
    try {
      const keys = JSON.parse(keyMap) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Fall through to the legacy anon key for older Supabase projects.
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "Phương thức không được hỗ trợ." }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = getPublishableKey();
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!authorization || !supabaseUrl || !supabaseKey) {
    return json(
      { error: "Vui lòng đăng nhập để sử dụng trợ lý sản phẩm." },
      401,
    );
  }
  if (!geminiApiKey)
    return json({ error: "Trợ lý AI chưa được cấu hình API key." }, 503);

  const token = authorization.replace(/^Bearer\s+/i, "");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: authError } =
    await supabase.auth.getUser(token);
  if (authError || !userResult.user)
    return json(
      { error: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." },
      401,
    );

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Dữ liệu yêu cầu không hợp lệ." }, 400);
  }

  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter(
          (item): item is ChatMessage =>
            !!item &&
            (item.role === "user" || item.role === "model") &&
            typeof item.content === "string" &&
            item.content.trim().length > 0,
        )
        .slice(-10)
        .map((item) => ({
          role: item.role,
          content: item.content.trim().slice(0, 1200),
        }))
    : [];
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ error: "Hãy nhập nhu cầu cần tư vấn." }, 400);
  }

  const { data: rows, error: productsError } = await supabase
    .from("products")
    .select(
      "id, name, description, price, stock_quantity, categories(name), product_images(image_url, sort_order)",
    )
    .eq("status", "active")
    .gt("stock_quantity", 0)
    .order("created_at", { ascending: false })
    .limit(100);
  if (productsError) {
    console.error(
      "Product assistant catalog query failed:",
      productsError.message,
    );
    return json(
      { error: "Không tải được danh sách sản phẩm. Vui lòng thử lại." },
      500,
    );
  }

  const catalog: CatalogProduct[] = (rows ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stock_quantity: row.stock_quantity,
    category: Array.isArray(row.categories)
      ? (row.categories[0] ?? null)
      : row.categories,
    image_url:
      row.product_images
        ?.slice()
        .sort((a: any, b: any) => a.sort_order - b.sort_order)[0]?.image_url ??
      null,
  }));

  const prompt = [
    "Danh mục sản phẩm hiện có (dữ liệu đáng tin cậy; chỉ tư vấn các sản phẩm trong danh sách này):",
    JSON.stringify(catalog),
    "",
    "Lịch sử hội thoại gần đây:",
    ...messages.map(
      (message) =>
        `${message.role === "user" ? "Khách hàng" : "Trợ lý"}: ${message.content}`,
    ),
  ].join("\n");

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          model: "gemini-3.5-flash-lite",
          store: false,
          system_instruction:
            "Bạn là trợ lý tư vấn mua sắm của Chợ Mây. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn, hỏi lại khi chưa rõ nhu cầu. Chỉ tư vấn từ danh mục được cung cấp; không tự bịa giá, tồn kho, tính năng hoặc sản phẩm. Nếu chưa có sản phẩm phù hợp, nói rõ và đề nghị khách thử nhu cầu khác. Trả kết quả theo đúng JSON schema.",
          input: prompt,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: {
              type: "object",
              properties: {
                message: { type: "string" },
                productIds: { type: "array", items: { type: "string" } },
              },
              required: ["message", "productIds"],
              additionalProperties: false,
            },
          },
        }),
      },
    );
  } catch (error) {
    console.error("Gemini request failed:", error);
    return json(
      { error: "Không kết nối được với trợ lý AI. Vui lòng thử lại." },
      502,
    );
  }

  if (!geminiResponse.ok) {
    let upstreamMessage = "";
    try {
      const upstreamError = await geminiResponse.json();
      if (typeof upstreamError?.error?.message === "string") {
        upstreamMessage = upstreamError.error.message
          .replace(/[\r\n\t]+/g, " ")
          .slice(0, 240);
      }
    } catch {
      // Do not return raw upstream responses or credentials to the app.
    }
    console.error(
      "Gemini returned status:",
      geminiResponse.status,
      upstreamMessage,
    );
    return json(
      {
        error: upstreamMessage
          ? `Gemini (${geminiResponse.status}): ${upstreamMessage}`
          : `Gemini trả về lỗi HTTP ${geminiResponse.status}. Kiểm tra API key và cấu hình model trong Supabase Logs.`,
      },
      502,
    );
  }

  let generated: {
    steps?: Array<{
      type?: string;
      text?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
    outputs?: Array<{ type?: string; text?: string }>;
  };
  try {
    generated = await geminiResponse.json();
  } catch {
    return json({ error: "Phản hồi từ trợ lý AI không hợp lệ." }, 502);
  }
  const outputText =
    generated.steps
      ?.filter((step) => step.type === "model_output" || step.type === "text")
      .flatMap((step) => [
        step.text ?? "",
        ...(step.content ?? [])
          .filter((item) => item.type === "text")
          .map((item) => item.text ?? ""),
      ])
      .join("\n")
      .trim() ||
    generated.outputs
      ?.filter((output) => output.type === "text")
      .map((output) => output.text ?? "")
      .join("\n")
      .trim();
  let recommendation: { message?: string; productIds?: string[] };
  try {
    recommendation = JSON.parse(outputText ?? "");
  } catch {
    console.error("Gemini response did not match the expected JSON format.");
    return json(
      { error: "Trợ lý chưa tạo được câu trả lời. Vui lòng thử lại." },
      502,
    );
  }

  const productById = new Map(catalog.map((product) => [product.id, product]));
  const recommendations = Array.isArray(recommendation.productIds)
    ? [...new Set(recommendation.productIds)]
        .map((id) => productById.get(id))
        .filter((product): product is CatalogProduct => !!product)
        .slice(0, 4)
    : [];
  return json({
    message:
      typeof recommendation.message === "string" &&
      recommendation.message.trim()
        ? recommendation.message.trim()
        : "Mình chưa tìm được gợi ý phù hợp. Bạn mô tả thêm nhu cầu nhé.",
    products: recommendations,
  });
});
