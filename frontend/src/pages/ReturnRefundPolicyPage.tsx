import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBrand } from '@/contexts/BrandContext';
import { publicStoreApi } from '@/lib/api';
import WebsiteLayout from '@/components/WebsiteLayout';
import Loader from '@/components/Loader';

export default function ReturnRefundPolicyPage() {
  const { t, locale } = useLanguage();
  const { publicPharmacyId } = useBrand();
  const [customPolicy, setCustomPolicy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        let pharmacyId = publicPharmacyId;
        if (!pharmacyId) {
          const list = await publicStoreApi.listPharmacies();
          pharmacyId = list[0]?.id ?? null;
        }
        if (pharmacyId) {
          const config = await publicStoreApi.getConfig(pharmacyId);
          if (!cancelled && config.return_refund_policy?.trim()) {
            setCustomPolicy(config.return_refund_policy.trim());
          } else if (!cancelled) {
            setCustomPolicy(null);
          }
        } else if (!cancelled) {
          setCustomPolicy(null);
        }
      } catch {
        if (!cancelled) setCustomPolicy(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [publicPharmacyId]);

  const isNe = locale === 'ne';

  if (loading) {
    return (
      <WebsiteLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 flex justify-center">
          <Loader variant="page" message={t('loading')} />
        </div>
      </WebsiteLayout>
    );
  }

  return (
    <WebsiteLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-theme-bg-elevated rounded-xl shadow border border-theme-border p-8">
          <h1 className="text-2xl font-bold text-theme-text mb-2">
            {t('return_refund_title')}
          </h1>
          <p className="text-sm text-theme-muted mb-6">
            {isNe
              ? 'खरिद र फिर्ता सम्बन्धी नीति। नेपालको उपभोक्ता संरक्षण र व्यापार ऐन अनुसार।'
              : 'Our return and refund policy. In line with consumer protection and fair trade practices.'}
          </p>

          {customPolicy ? (
            <article className="prose prose-theme max-w-none text-theme-text whitespace-pre-wrap break-words">
              {customPolicy}
            </article>
          ) : (
            <article className="prose prose-theme max-w-none text-theme-text space-y-6">
              {isNe ? (
                <>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">१. फिर्ता योग्यता</h2>
                    <p>
                      तपाईंले खरिद गरेको उत्पादन बिग्रिएको, गलत वस्तु वितरण भएको, वा निर्दिष्ट गुणस्तरको छैन भने हामी फिर्ता वा सट्टा स्वीकार गर्छौं। दवाई तथा स्वास्थ्य सम्बन्धी उत्पादनहरूमा सील खुल्ने र स्वास्थ्य कारणले फिर्ता सीमित हुन सक्छ।
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">२. समयसीमा</h2>
                    <p>
                      फिर्ता अनुरोध खरिद मिति वा वितरण मितिको ७ दिनभित्र गर्नुपर्छ। विशेष अवस्थामा (दोषपूर्ण वस्तु) यो अवधि बढाउन सकिन्छ।
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">३. प्रक्रिया</h2>
                    <p>
                      फिर्ता चाहनुहुन्छ भने हामीलाई सम्पर्क गर्नुहोस् (इमेल वा फोन)। अर्डर नम्बर र कारण उल्लेख गर्नुहोस्। हामी अनुमोदन पछि उत्पादन फिर्ता लिने र जाँच पछि रकम फिर्ता वा सट्टा दिनेछौं।
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">४. रकम फिर्ता</h2>
                    <p>
                      स्वीकृत फिर्तामा भुक्तानी मूल रकम (उत्पादन मूल्य) फिर्ता गरिनेछ। ढुवानी शुल्क विशेष अवस्थामा मात्र फिर्ता गरिन्छ। रकम फिर्ता गर्न ७–१४ कार्य दिन लाग्न सक्छ।
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">५. फिर्ता स्वीकार नहुने</h2>
                    <p>
                      खुलिएको दवाई वा व्यक्तिगत प्रयोगको लागि बिक्री भएका वस्तु, म्यानुअल प्रयोग पछि क्षति भएका वस्तु र निर्दिष्ट उत्पादनहरू फिर्ता स्वीकार हुँदैन। नेपालको उपभोक्ता संरक्षण ऐन अनुसार व्यापारीले योग्य फिर्ता/प्रतिस्थापन दिनुपर्छ।
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">६. सम्पर्क</h2>
                    <p>
                      फिर्ता वा रकम सम्बन्धी प्रश्नको लागि स्टोरको सम्पर्क ठेगाना वा इमेल प्रयोग गर्नुहोस्। हामी तपाईंको अनुरोधको जवाफ दिन प्रयास गर्छौं।
                    </p>
                  </section>
                </>
              ) : (
                <>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">1. Eligibility for Returns</h2>
                    <p>
                      We accept returns or replacement if the product you received is damaged, incorrect, or does not meet the specified quality. For medicines and health-related products, opened seals and health regulations may limit returns.
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">2. Timeframe</h2>
                    <p>
                      Return requests must be made within 7 days of the purchase or delivery date. In special cases (e.g. defective items) this period may be extended.
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">3. Process</h2>
                    <p>
                      To request a return, contact us by email or phone. Please provide your order number and reason. Once approved, we will arrange for the product to be returned and, after inspection, process a refund or replacement.
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">4. Refunds</h2>
                    <p>
                      For approved returns, the original amount (product price) will be refunded. Shipping charges may be refunded only in special circumstances. Refunds are typically processed within 7–14 business days.
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">5. Non-returnable Items</h2>
                    <p>
                      Opened medicines or items sold for personal use, items damaged after use, and certain specified products are not eligible for return. Under Nepal&apos;s consumer protection framework, we are committed to offering eligible returns or replacement where applicable.
                    </p>
                  </section>
                  <section>
                    <h2 className="text-lg font-semibold mt-4 mb-2">6. Contact</h2>
                    <p>
                      For return or refund inquiries, please use the store&apos;s contact details shown on this site. We will respond to your request as soon as possible.
                    </p>
                  </section>
                </>
              )}
            </article>
          )}

          <p className="mt-8 text-sm text-theme-muted">
            <Link to="/terms" className="text-careplus-primary hover:underline">{t('auth_terms_and_conditions')}</Link>
            {' · '}
            <Link to="/privacy" className="text-careplus-primary hover:underline">{t('auth_privacy_policy')}</Link>
            {' · '}
            <Link to="/products" className="text-careplus-primary hover:underline">{t('nav_products')}</Link>
          </p>
        </div>
      </div>
    </WebsiteLayout>
  );
}
