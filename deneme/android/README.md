# kobiPDF Android deneme (Adım 0)

Amaç: `docs/ANDROID-PLAN.md` Adım 0. Masaüstündeki gerçek metin silme kodu (`src/renderer/src/editing/eraseText.ts`,
MuPDF WebAssembly) telefonun WebView'ında çalışıyor mu, ne kadar sürüyor, büyük dosyada bellek yetiyor mu?
Bu klasör ürüne girmez; `main`'e birleştirilmez. Sonuç çıkınca plan güncellenir.

## Yerel oturumda çalıştırma (Windows, USB ile bağlı telefon)
Gerekenler: Android Studio (Android SDK ve JDK 21 onunla gelir), telefonda Geliştirici seçenekleri > USB hata ayıklama açık.
Kök klasörde `npm install` yapılmış olmalı (pdfjs-dist, pdf-lib, mupdf oradan alınır).

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
CSP engeli yok. Gerçek telefon ve büyük dosya henüz denenmedi.
