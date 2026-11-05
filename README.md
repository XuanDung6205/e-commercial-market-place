# Chợ Mây — E-commerce Marketplace

Ứng dụng thương mại điện tử đa nền tảng, xây dựng bằng Expo và React Native. Project có trải nghiệm mua sắm cho khách hàng, khu vực quản trị và Supabase làm backend.

## Tính năng

### Tài khoản và phân quyền

- Đăng ký, đăng nhập bằng email và mật khẩu; hỗ trợ khôi phục mật khẩu.
- Lưu phiên đăng nhập và lấy thông tin tài khoản từ Supabase Auth.
- Chuyển người dùng đến khu vực tương ứng sau khi đăng nhập: khách hàng hoặc quản trị viên.
- Khu vực quản trị kiểm tra vai trò tài khoản trước khi cho phép truy cập.

### Mua sắm

- Trang chủ hiển thị banner, danh mục và các sản phẩm được giới thiệu.
- Duyệt danh sách sản phẩm đang hoạt động; tìm theo tên với kết quả cập nhật khi nhập.
- Xem thông tin chi tiết, hình ảnh, giá, giá so sánh và các biến thể sản phẩm nếu có.
- Lưu danh sách sản phẩm yêu thích; tìm kiếm trong danh sách này.
- Thêm sản phẩm vào giỏ hàng, chọn sản phẩm cần thanh toán và áp dụng voucher.
- Xem phần tổng kết đơn hàng, bao gồm tạm tính, giảm giá, phí vận chuyển và số tiền cần thanh toán.

### Đặt hàng và sau mua

- Đặt hàng với thông tin người nhận, số điện thoại, địa chỉ và ghi chú giao hàng.
- Chọn phương thức COD, chuyển khoản hoặc ví điện tử khi tạo đơn.
- Xem danh sách đơn hàng, trạng thái và chi tiết từng đơn; hủy đơn khi còn đủ điều kiện.
- Nhận và xem thông báo liên quan đến đơn hàng và khuyến mãi.
- Gửi đánh giá sản phẩm bằng số sao, thẻ nhận xét nhanh và nội dung văn bản; cập nhật đánh giá đã gửi.

### Hồ sơ cá nhân

- Xem email và thông tin tài khoản.
- Cập nhật họ tên, số điện thoại, địa chỉ giao hàng và ảnh đại diện.
- Đăng xuất khỏi tài khoản.

### Trợ lý sản phẩm

- Mô tả nhu cầu mua sắm bằng ngôn ngữ tự nhiên để nhận gợi ý sản phẩm.
- Gợi ý dựa trên sản phẩm đang hoạt động và còn hàng trong catalog.
- Yêu cầu đăng nhập; cần deploy Supabase Edge Function và cấu hình `GEMINI_API_KEY` để sử dụng.

### Khu vực quản trị

- Quản lý sản phẩm và biến thể; tạo, sửa và cập nhật trạng thái sản phẩm.
- Quản lý danh mục và banner hiển thị trên trang chủ.
- Quản lý voucher, tài khoản người dùng và đánh giá.
- Theo dõi đơn hàng, xem chi tiết và cập nhật trạng thái xử lý.
- Xem trang thống kê quản trị.

### Giới hạn hiện tại

- Tìm kiếm hiện lọc theo **tên sản phẩm**; màn lọc nâng cao chưa được triển khai hoàn chỉnh.
- project chưa tích hợp cổng thanh toán để xử lý giao dịch trực tuyến.
- Nút tải ảnh/video lên đánh giá hiện là giao diện chờ triển khai; chức năng này chưa hoạt động.
- Các tính năng cần Supabase phải có database migrations, RLS và biến môi trường được cấu hình đúng.

## Công nghệ

- **Expo SDK 58**, **React Native 0.88**, **React 19**
- **Expo Router** cho điều hướng theo file
- **TypeScript**
- **Supabase** cho Auth, PostgreSQL, Row Level Security, Storage và Edge Functions
- **React Native Web** cho phiên bản web

## Yêu cầu

- Node.js phiên bản LTS và npm.
- Project Supabase đã tạo.
- Expo Go hoặc emulator phù hợp để chạy ứng dụng trên thiết bị.
- (Tùy chọn) Gemini API key để bật trợ lý AI.

## Cài đặt và chạy local

1. Clone repository và chuyển vào thư mục project:

   ```bash
   git clone <REPOSITORY_URL>
   cd E-Commercial_market_place
   ```

2. Cài dependencies:

   ```bash
   npm ci
   ```

3. Tạo file `.env.local` ở thư mục gốc:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   Lấy URL và publishable key trong phần API settings của Supabase. Ứng dụng cũng hỗ trợ tên biến `EXPO_PUBLIC_SUPABASE_ANON_KEY` để tương thích với cấu hình cũ.

4. Khởi động ứng dụng:

   ```bash
   npm start
   ```

   Dùng QR code với Expo Go, hoặc chọn một trong các lệnh sau:

   ```bash
   npm run web
   npm run android
   npm run ios
   ```

   Chạy iOS native cần macOS và môi trường phát triển iOS phù hợp. Lệnh `npm run web` chạy ứng dụng trên trình duyệt.

## Cấu hình Supabase

### Database và quyền truy cập

Các migration trong `supabase/migrations/` là nguồn cập nhật database theo phiên bản. Sau khi cài Supabase CLI và xác thực:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Các migration tạo schema, chính sách RLS, đơn hàng, đánh giá và cấu hình Storage. Không đưa `service_role` key vào ứng dụng hoặc bất kỳ biến `EXPO_PUBLIC_*` nào.

Các file SQL tham khảo:

- `supabase/schema.sql`: schema tổng hợp.
- `supabase/policies.sql`: chính sách RLS.
- `supabase/seed.sql`: dữ liệu mẫu.

Ưu tiên chạy migrations bằng Supabase CLI trên môi trường đã link; chỉ chạy dữ liệu mẫu khi cần và sau khi đã áp dụng schema.

### Trợ lý AI sản phẩm (tùy chọn)

Edge Function nằm tại `supabase/functions/product-assistant/`. Function yêu cầu người dùng đăng nhập và dùng Gemini API key phía server.

1. Thêm `GEMINI_API_KEY` trong **Supabase Dashboard → Edge Functions → Secrets**.
2. Deploy function:

   ```bash
   npx supabase functions deploy product-assistant
   ```

Không đặt Gemini API key trong `.env.local`, biến Vercel `EXPO_PUBLIC_*` hoặc mã frontend. Xem thêm hướng dẫn tại `supabase/functions/product-assistant/README.md`.

## Build và deploy web lên Vercel

Project hiện cấu hình Metro với `web.output: "single"` trong `app.json`, phù hợp để xuất ứng dụng web dạng SPA:

```bash
npx expo export -p web
```

Build output được tạo tại `dist/`. Có thể cấu hình Vercel Dashboard như sau:

| Trường | Giá trị |
| --- | --- |
| Framework Preset | Other |
| Root Directory | `./` |
| Build Command | `npx expo export -p web` |
| Output Directory | `dist` |
| Install Command | `npm ci` |

Thêm các biến môi trường sau trong Vercel cho các môi trường cần triển khai (**Production**, và **Preview** nếu dùng preview deployment):

| Tên biến | Giá trị |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

Để các đường dẫn Expo Router hoạt động khi mở trực tiếp hoặc tải lại trang, thêm `vercel.json` ở thư mục gốc với nội dung:

```json
{
  "rewrites": [
    {
      "source": "/:path*",
      "destination": "/"
    }
  ]
}
```

Các biến `EXPO_PUBLIC_*` được nhúng vào bundle frontend và có thể được người dùng nhìn thấy. Chỉ dùng chúng cho Supabase URL và publishable key; không dùng secret/service role key. Bảo vệ dữ liệu bằng RLS và chính sách Supabase phù hợp.

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm start` | Khởi động Expo development server |
| `npm run web` | Chạy ứng dụng trên web |
| `npm run android` | Khởi động Expo với Android |
| `npm run ios` | Khởi động Expo với iOS |
| `npm run lint` | Chạy Expo lint |
| `npx tsc --noEmit` | Kiểm tra kiểu TypeScript |
| `npx expo export -p web` | Build ứng dụng web vào `dist/` |

## Cấu trúc thư mục

```text
app/                    Expo Router routes (auth, customer, admin, checkout)
src/components/         UI components theo tính năng
src/hooks/              React hooks
src/services/           Supabase và các dịch vụ nghiệp vụ
src/store/              State stores
src/types/              TypeScript và database types
src/utils/              Hàm tiện ích
supabase/migrations/    Database migrations
supabase/functions/     Supabase Edge Functions
assets/                 Font, icon và hình ảnh
```

## Điều hướng chính

- `/` — màn hình đăng nhập.
- `/(auth)/login`, `/(auth)/register`, `/(auth)/forgot-password` — xác thực.
- `/(tabs)/home`, `/(tabs)/search`, `/(tabs)/favorites`, `/(tabs)/inbox`, `/(tabs)/account` — khu vực khách hàng.
- `/cart`, `/payment`, `/order-success`, `/my-orders` — giỏ hàng và đơn hàng.
- `/(admin)/...` — dashboard và các màn quản trị.

Các nhóm route trong ngoặc như `(auth)` và `(tabs)` là route groups của Expo Router, không xuất hiện trong URL.
