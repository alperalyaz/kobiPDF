# Microsoft Store: yeni tanıtım görsellerini yükleme (yerel oturum için talimat)

Ürün: kobiPDF, Store kimliği **9NJVFT7MHLGP** (Partner Center > Apps and games > kobiPDF).

## Dosyalar
- `docs/store/showcase/tr/01.png ... 05.png` (Türkçe listeleme)
- `docs/store/showcase/en/01.png ... 05.png` (English listing)
- Hepsi 1920x1080 PNG. Sahneler OpenAI (gpt-image-2) ile gerçek ekran görüntüsünden üretildi; başlık yazısı görselin içinde.

| Sıra | TR başlık | EN başlık | Önerilen açıklama (caption) TR / EN |
|---|---|---|---|
| 01 | PDF’teki yazıyı gerçekten değiştirin. | Really change the text in a PDF. | Yazıya tıklayın, değiştirin; eski yazı dosyadan silinir. / Click the text and change it; the old text is removed from the file. |
| 02 | Kaşe ve imza tek tıkla. | Stamp and sign in one click. | İmzanızı çizin ya da kaşe resminizi yükleyin. / Draw your signature or upload your stamp. |
| 03 | Vurgulayın, not alın, işaretleyin. | Highlight, annotate, mark up. | Vurgu, altını/üstünü çizme, kalem ve yapışkan not. / Highlight, underline, strikeout, pen and sticky notes. |
| 04 | Birleştirin, bölün, sıralayın. | Merge, split, reorder. | Sayfaları döndürün, silin, sıralayın; PDF birleştirin ve bölün. / Rotate, delete, reorder; merge and split PDFs. |
| 05 | Ücretsiz. İnternetsiz. Aboneliksiz. | Free. Offline. No subscription. | Hesap yok, reklam yok, veri toplanmaz. / No account, no ads, no data collected. |

## Adımlar (yerel oturumdaki ajan yapar, tarayıcıda Partner Center oturumu açıkken)
1. `git fetch origin claude/gracious-goodall-f29sox` ve bu klasörü al.
2. Partner Center > kobiPDF > **Start update** (yeni gönderim). Paket DEĞİŞMEZ, yalnız Store listings.
3. **Türkçe (tr-tr)** listeleme > Screenshots (Desktop): mevcut görsellerin ÖNÜNE `tr/01..05.png` sırayla eklenir; eski gerçek ekran görüntüleri arkada kalabilir (en fazla 10). Her birine yukarıdaki TR açıklama.
4. **English (en-us)** listeleme: aynısı `en/01..05.png` ve EN açıklamalarla.
5. Gönderimi **Submit to the Store** ile sertifikasyona yolla. Sertifikasyon genelde 1-3 iş günü.
6. Yayınlanınca `https://apps.microsoft.com/detail/9njvft7mhlgp?hl=tr-tr` sayfasında yeni görsellerin göründüğünü ekran görüntüsüyle doğrula ve kullanıcıya bildir.

Not: Microsoft politikası (10.1) görsellerin uygulamayı doğru yansıtmasını ister. Ekrandaki arayüz gerçek ekran görüntüsünden üretildi; sertifikasyon itiraz ederse 01-05 "Additional art assets / promotional" bölümüne taşınır, Screenshots'ta yalnız `docs/store/screenshots/` kalır.
