# BurnoDrone Admin

Aplikasi admin terpisah untuk katalog BurnoDrone. Datanya ada di Supabase (sama dengan drone-hub),
perubahan dikirim lewat repo `burnodrone-api`.

## Jalankan
```bash
npm install
cp .env.example .env.local   # isi nilainya
npm run dev
```
Buka http://localhost:3000 lalu login dengan akun admin Supabase.

## Prasyarat
- API (`burnodrone-api`) sudah berjalan dan `NEXT_PUBLIC_API_URL` menunjuk ke sana.
- Alamat aplikasi ini (mis. `http://localhost:3000`, lalu URL produksi) ada di `ALLOWED_ORIGINS` milik API.
- `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sama dengan drone-hub.

## Deploy
Vercel paling mudah: import repo, isi environment variables dari `.env.example`, deploy.
Build menghasilkan situs statis (`output: "export"`), jadi bisa juga di GitHub Pages
(isi `NEXT_PUBLIC_BASE_PATH` dengan `/nama-repo`).
# burnodrone-admin
