
# 🤖 XOS TESNET

Bot otomatis untuk menjalankan **tugas harian** dan **swap token** di jaringan **XOS (https://x.ink)** secara berkala. Dibuat dengan `Node.js` dan `ethers.js`, bot ini mendukung **multi-wallet**, **login otomatis**, dan **looping harian 24 jam**.

---

## 🖼️ Output Terminal

## ✨ Fitur Utama

### 🔐 Login Otomatis
- Menggunakan **digital signature (ethers.js)** untuk login ke XOS.
- Mengambil sign-message dan mengirim signature ke `/verify-signature2`.

### 📅 Daily Tasks
- **Check-in harian** ke endpoint `/check-in`
- Melihat jumlah **poin akun**
- Menjalankan **Garapon Draw** jika tersedia (`/draw`)

### 🔄 Auto Swap Token
- Mendukung berbagai pair swap:
```

XOS <-> WXOS
XOS -> USDC, BNB, SOL, JUP

````
- Fungsi `wrap` (XOS→WXOS) dan `unwrap` (WXOS→XOS)
- Swap token lain dilakukan melalui `exactInputSingle()` dari contract router

### 🧍 Multi-Wallet Support
- Membaca banyak private key dari file `privatekey.txt`
- Memproses wallet satu per satu secara bergiliran

### ⏱️ Loop Otomatis 24 Jam
- Setelah semua wallet selesai, bot akan **tidur selama 24 jam**
- Kemudian otomatis **berjalan ulang**

### 🎨 Logging Berwarna
- Logging dengan kode warna:
- ✅ Hijau: Sukses
- ❌ Merah: Gagal
- ⚠️ Kuning: Sudah dilakukan / dilewati
- Menampilkan informasi dengan rapi: waktu, status, dan progress

### 🎲 Randomisasi
- Jumlah swap per iterasi diacak (`MIN_SWAP` - `MAX_SWAP`)
- Waktu delay antar swap juga random

---

## ⚙️ Konfigurasi Default

```js
ITERATIONS: 5                // Jumlah siklus swap
MIN_SWAP: 0.00005
MAX_SWAP: 0.0001
MIN_DELAY: 10000             // 10 detik
MAX_DELAY: 15000             // 15 detik
RPC_URL_XOS: https://testnet-rpc.x.ink/
````

---

## 📁 File yang Dibutuhkan

### `privatekey.txt`

* File berisi daftar private key, satu per baris.
* Contoh isi:

  ```
  0xabc123....
  0xdef456....
  ```

---

## 🚀 Cara Menjalankan

1. Pastikan sudah install dependensi:

   ```bash
   npm install
   ```

2. Buat file `privatekey.txt` di root folder.

3. Jalankan bot:

   ```bash
   node bot.js
   ```

---

## ⚠️ Peringatan Keamanan

> **JANGAN gunakan wallet utama Anda!**
> Gunakan hanya wallet khusus testnet.

* Bot ini menyimpan dan menggunakan **private key**.
* Approval token dilakukan maksimal (`MaxUint256`)
* Hanya gunakan di jaringan `testnet` atau wallet non-prioritas.

---

## 📞 Kredit

Bot ini dibuat oleh komunitas testnet, developer: [@BYDONTOL](https://t.me/FxcTe).
Script didesain untuk **eksplorasi teknis dan automasi tugas testnet**.

---

## ✅ Status: Aktif & Siap Pakai

* Mendukung auto login, daily task, dan swap
* Cocok digunakan untuk **farming point harian** di XOS

---
