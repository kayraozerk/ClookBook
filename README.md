# 📚 ClookBook

**ClookBook**, okuma alışkanlıklarını takip etmeni sağlayan bir web uygulamasıdır.  
Node.js, Express, MongoDB ve saf HTML/CSS/JS kullanılarak geliştirilmiştir.  

---

## ✨ Özellikler

- 🔐 **Kullanıcı Sistemi**
  - Kayıt olma, giriş yapma ve çıkış yapma
  - Her kullanıcı kendi kitaplarını ve oturumlarını görür

- 📖 **Kitap Yönetimi**
  - Kitap ekleme, düzenleme, silme
  - Kitabın toplam sayfa sayısını ve başlangıç tarihini kaydetme
  - İlerleme yüzdesi otomatik hesaplanır

- ⏱ **Okuma Seansları**
  - Kronometre başlat/durdur/sıfırla
  - Başlangıç & bitiş sayfası girilerek **okunan sayfa sayısı** hesaplanır
  - Ortalama okuma hızı (dk/sayfa) otomatik bulunur
  - Seans verileri MongoDB’ye kaydedilir

- 📊 **Özet ve İstatistikler**
  - Kitap ilerleme yüzdesi (progress bar)
  - Günlük ortalama okuma (her zaman 1. sayfadan itibaren hesaplanır)
  - Toplam okunan süre (tüm seansların toplamı, saat/dk/sn formatında)

---

## 🛠 Teknolojiler

- **Backend:** Node.js + Express
- **Database:** MongoDB (Mongoose ODM)
- **Auth:** JWT + HttpOnly Cookie
- **Frontend:** Saf HTML, CSS (dark theme), Vanilla JS
- **Diğer:** dotenv, bcrypt

---

## 🚀 Kurulum

Projeyi yerel ortamında çalıştırmak için:

```bash
# Reponun klonunu al
git clone https://github.com/kayraozerk/ClookBook.git
cd ClookBook

# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini ayarla (.env dosyası oluştur)
cp .env.example .env

# Sunucuyu başlat
node app.js
