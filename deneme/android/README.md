# kobiPDF Android deneme (Adım 0)

Amaç: `docs/ANDROID-PLAN.md` Adım 0. Masaüstündeki gerçek metin silme kodu (`src/renderer/src/editing/eraseText.ts`,
MuPDF WebAssembly) telefonun WebView'ında çalışıyor mu, ne kadar sürüyor, büyük dosyada bellek yetiyor mu?
Bu klasör ürüne girmez; `main`'e birleştirilmez. Sonuç çıkınca plan güncellenir.

## Yerel oturumda çalıştırma (Windows, USB ile bağlı telefon)
Gerekenler: Android Studio (Android SDK ve JDK 21 onunla gelir), telefonda Geliştirici seçenekleri > USB hata ayıklama açık.
Kök klasörde `npm install` yapılmış olmalı (pdfjs-dist, pdf-lib, mupdf oradan alınır).

Java: Gradle 8.14, Android Studio'nun yeni sürümlerindeki Java 25 ile çalışmaz ("Unsupported class file major version 69").
JDK 21 seçilmeli, örneğin Android Studio'nun indirdiği JBR 21 (yolu bilgisayara göre değişir):

    $env:JAVA_HOME = "$env:USERPROFILE\.jdks\jbr-21.0.11"
    $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Xiaomi / Redmi telefonlarda ayrıca Geliştirici seçenekleri > "USB ile yükle" açık olmalı; yoksa kurulum
`INSTALL_FAILED_USER_RESTRICTED` ile reddedilir.

    cd deneme\android
    npm install
    npm run android

`npm run android`: web kısmını derler, Android projesine kopyalar, telefona kurup açar. Telefon listede birden çoksa seçim sorar.

## Denenecekler
1. "Örnek PDF ile dene": küçük bir belge, sonuç BAŞARILI olmalı.
2. "Telefondan PDF seç" ile sırayla yaklaşık 1 MB, 10 MB ve 50 MB'lık gerçek PDF'ler (örneğin bir Mikro teklifi, büyük katalog).
3. "Sonucu kaydet ve paylaş": Belgeler/kobiPDF klasörüne yazılıp Paylaş menüsü açılmalı.
4. Ekrandaki kayıt satırlarını (süre, bellek, SONUÇ) ve çökme olursa `adb logcat | findstr KOBIPDF` ve
   `adb logcat *:E` çıktısını not et.

## Bulutta denenen (Chromium, Pixel 7 görünümü, 24.11.2026)
Örnek PDF: ilk çizim 96 ms, MuPDF silme (WebAssembly yüklemesi dahil) 116 ms, pdf-lib 39 ms, eski yazı dosyada yok,
CSP engeli yok.

## Gerçek telefonda denenen (24.11.2026)
Xiaomi Redmi 12 (23053RN02A), Android 15, 8 GB RAM, Android System WebView 149. Hata ayıklama APK'sı, USB ile.
Her denemede ilk sayfadaki en uzun yazı MuPDF ile silindi, yerine pdf-lib ile yeni yazı yazılıp kaydedildi.

| Dosya | İlk sayfayı çiz | MuPDF ile sil | pdf-lib ile kaydet | Sonuç |
|---|---|---|---|---|
| Örnek, 0,02 MB | 0,4 sn | 0,5 sn | 0,1 sn | BAŞARILI |
| Teknik destek rehberi, 1,0 MB | 0,4 sn | 0,5 sn | 0,3 sn | BAŞARILI |
| Vana fiyat listesi, 10,8 MB | 1,7 sn | 0,5 sn | 2,9 sn | BAŞARILI |
| Büyük fiyat listesi, 53,4 MB | 0,8 sn | 4,9 sn | 23,2 sn | BAŞARILI |

- Dördünde de eski yazı dosyadan gerçekten silindi, yeni yazı geldi. Çökme ve CSP engeli olmadı.
- Yavaş olan kaydetme: 53 MB'da pdf-lib `save()` 23 saniye. Asıl uygulamada ilerleme göstergesi gerekir.
- Ekrandaki "JS bellek" satırı WebAssembly ve dosya belleğini saymıyor, hep 10 MB gösterir; işe yaramaz.
  Gerçek bellek ölçülemedi, ama 53 MB dosyada çökmemesi belleğin yettiğini gösteriyor.
- "Sonucu kaydet ve paylaş" düğmesi henüz denenmedi.
- Uygulama şifresiz `http://` bağlantısına izin vermiyor (Android varsayılanı); asıl uygulamada da gerek yok.
