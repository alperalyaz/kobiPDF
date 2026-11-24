# kobiPDF Android planı (Capacitor, aynı repo)

Durum: plan, henüz kod yok. 24.11.2026. Plan eleştirisinden geçti; bulgular aşağıya işlendi.

## Kapsam (v1)
Var: PDF aç (dosya seçici ve "Birlikte aç / Paylaş"), görüntüle (kaydırma, iki parmakla yakınlaştırma),
Metni Düzenle (dokun-düzelt, eski yazı MuPDF ile gerçekten silinir), İmza / Kaşe (kayıtlı liste, yerleştir,
taşı, boyutlandır), kopya olarak kaydet ve Paylaş.
Yok: vurgulama, kalem, sayfa işlemleri, yazdırma, sekmeler, varsayılan uygulama.

## Adım 0 - Deneme (karar noktası, önce bu)
En büyük belirsizlik MuPDF'in (WebAssembly, yaklaşık 10 MB) telefondaki WebView içinde çalışıp çalışmadığı ve bellek.
- Ayrı bir deneme dalında boş bir Capacitor uygulaması: pdf.js ile aç, `eraseText` ile bir yazıyı sil, pdf-lib ile kaydet.
- Derleme ve deneme YEREL oturumda yapılır: kullanıcının Windows bilgisayarı, USB ile bağlı Android telefon
  (`npx cap run android`, hata kayıtları `adb logcat`). Bulut oturumu Android derleyemez; kodu hazırlayıp dala koyar.
- Ölçülecekler: 1 MB, 10 MB ve 50 MB PDF ile çalışıyor mu, ne kadar sürüyor, çöküyor mu; en düşük Android / WebView sürümü;
  Capacitor köprüsünün CSP'den ne istediği.
- Sonuç kötüyse: kapsam "yalnız imza / kaşe" (MuPDF'siz, pdf-lib ile) olur ya da Android iptal edilir.

## Adım 1 - Ortak kod: tek arayüz, Android için `window.api` taklidi
- İkinci bir giriş (ayrı mobil uygulama, ikinci Vite ayarı) YOK. Mevcut renderer kullanılır; Capacitor `webDir` onun çıktısıdır.
- Android'de `window.api`, `KobiPdfApi` arayüzünü Capacitor ile uygulayan bir nesne olur (shim). window.api çağıran
  10 dosya değişmez. Masaüstüne özgü olanlar (yazdırma, varsayılan uygulama, kapatma koruması, klasör seçme) Android'de
  boş döner, düğmeleri gizlenir.
- Dosya yolu anlamı: Android'de kalıcı yol yok (content:// adresi, geçici izin). Açılan belgenin `path` değeri `null`
  olur, böylece Kaydet her zaman "kopya olarak kaydet"e düşer: Belgeler/kobiPDF klasörüne yazılır ve Paylaş menüsü açılır.
  Üzerine yazma Android'de yoktur.

## Adım 2 - Telefon kabuğu
- `App.tsx` içinde Android ise şerit menü, başlık çubuğu ve kenar çubuğu yerine üst çubuk (Aç, Kaydet / Paylaş) ve alt çubuk
  (Görüntüle / Metin / Kaşe).
- Dokunmatik: düzenleme katmanlarında `touch-action` ayarı (yoksa kaydırma, taşı / boyutlandırmayı keser); iki parmak
  yakınlaştırmada geçici CSS ölçeği, bırakınca yeniden çizim; parmak boyunda tutamaçlar; telefonda daha düşük tuval sınırı.
- Sanal klavye: yazı düzenlenirken pencere küçülünce yakınlaştırma yeniden hesaplanmaz, düzenleme kutusu klavyenin üstüne kaydırılır.
- İmza / Kaşe penceresi dar ekrana uyar. Liste telefonun kendisinde tutulur, masaüstüyle paylaşılmaz.

## Adım 3 - Android'e özgü kod
- AndroidManifest: `application/pdf` için VIEW ve SEND. Gelen dosyayı web tarafına aktarmak için MainActivity'de küçük Kotlin kodu.
- Döndürme ve arka plana atmada düzenleme kaybolmasın: `configChanges` ayarı.
- Dosya seçici: bakımı süren bir eklenti ya da kendi küçük kodumuz. `MANAGE_EXTERNAL_STORAGE` izni kullanılmaz (Play politikası).

## Adım 4 - Yazı tipleri (masaüstünü de etkiler, ayrı karar)
- Liberation Sans / Serif / Mono (SIL OFL) gömülür; yalnız sistemde Arial / Times / Courier YOKSA kullanılır.
  Windows gerçek Arial'ı kullanmaya devam eder.
- Bilinen sınır: Tahoma, Calibri, Verdana, Segoe'nin ücretsiz ölçü ikizi yok; Android'de DejaVu'ya düşer, yeni yazı biraz geniş görünür.

## Adım 5 - Yayın
- İmzalı AAB GitHub Actions'ta üretilir. İmza anahtarı ve parolaları GitHub Secrets'ta durur, repoya ASLA girmez
  (`.gitignore`: `*.jks`, `*.keystore`, `keystore.properties`; derlemede kontrol).
- Hakkında penceresindeki lisans listesine Capacitor ve Liberation eklenir.
- Play: güncel hedef API seviyesi, tanıtım metni, gizlilik sayfası (hidroteknik.si/gizlilik/kobipdf).

## Çalışma düzeni
Telefonda deneme gereken her adım (0, 2, 3, 5) yerel oturumda, USB bağlı telefonla yapılır.
Her adım kendi `bekleyen/<konu>` dalında. Masaüstüne dokunan değişiklik (Adım 1, 2, 4) yayından önce Windows'ta elle denenir.
