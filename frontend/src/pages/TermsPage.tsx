import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import WebsiteLayout from '@/components/WebsiteLayout';

export default function TermsPage() {
  const { t, locale } = useLanguage();
  const isNe = locale === 'ne';

  return (
    <WebsiteLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-theme-bg-elevated rounded-xl shadow border border-theme-border p-8">
          <h1 className="text-2xl font-bold text-theme-text mb-2">
            {t('terms_title')}
          </h1>
          <p className="text-sm text-theme-muted mb-6">
            {isNe
              ? 'नेपाल सरकारको इलेक्ट्रोनिक लेनदेन ऐन, २०६३ र सम्बन्धित नियमहरू अनुसार।'
              : 'In accordance with the Government of Nepal Electronic Transaction Act, 2063 (2006) and related rules.'}
          </p>

          <article className="prose prose-theme max-w-none text-theme-text space-y-6">
            {isNe ? (
              <>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">१. स्वीकृति</h2>
                  <p>
                    यो सेवा प्रयोग गर्दा तपाईं यी नियम तथा शर्तहरूसँग सहमत हुनुहुन्छ। नेपालको इलेक्ट्रोनिक लेनदेन ऐन, २०६३ ले इलेक्ट्रोनिक रेकर्ड र डिजिटल लेनदेनलाई मान्यता दिन्छ। तपाईंले दिइने जानकारी सही र पूर्ण हुनुपर्छ।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">२. सेवाको प्रयोग</h2>
                  <p>
                    CarePlus फार्मेसी व्यवस्थापन र खरिद सेवा प्रदान गर्दछ। तपाईंले सेवालाई कानून अनुसार मात्र प्रयोग गर्नुहुन्छ र कुनै पनि धोका, गलत प्रतिनिधित्व वा अवैध कार्य गर्ने छैन।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">३. खाता जिम्मेवारी</h2>
                  <p>
                    तपाईं आफ्नो खाता जानकारी गोप्य राख्नुहुन्छ र आफ्नो खातामा भएका क्रियाकलापको लागि जिम्मेवार हुनुहुन्छ। कुनै पनि अनधिकृत प्रयोगको लागि सेवा प्रदायक जिम्मेवार हुँदैन।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">४. नेपाल कानून</h2>
                  <p>
                    यी नियम तथा शर्तहरू नेपालको प्रचलित कानून, इलेक्ट्रोनिक लेनदेन ऐन २०६३ र नेपाल सरकारको नीतिहरू अनुसार व्याख्या गरिनेछ। विवादको अवस्थामा नेपालको अदालतहरूको अधिकार क्षेत्र लागू हुनेछ।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">५. सम्पर्क</h2>
                  <p>
                    प्रश्नहरूको लागि कृपया हामीलाई सम्पर्क गर्नुहोस्। हामी तपाईंको गोप्यता सम्मान गर्छौं र <Link to="/privacy" className="text-careplus-primary hover:underline">{t('auth_privacy_policy')}</Link> अनुसार डाटा व्यवस्थापन गर्छौं।
                  </p>
                </section>
              </>
            ) : (
              <>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">1. Acceptance</h2>
                  <p>
                    By using this service, you agree to these Terms and Conditions. The Government of Nepal Electronic Transaction Act, 2063 (2006) recognizes electronic records and digital transactions. Information you provide must be accurate and complete.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">2. Use of Service</h2>
                  <p>
                    CarePlus provides pharmacy management and shopping services. You will use the service only in accordance with applicable law and will not use it for any fraud, misrepresentation, or illegal activity.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">3. Account Responsibility</h2>
                  <p>
                    You are responsible for keeping your account information confidential and for all activity under your account. The service provider is not liable for any unauthorized use.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">4. Nepal Law</h2>
                  <p>
                    These Terms and Conditions shall be interpreted in accordance with the laws of Nepal in force, the Electronic Transaction Act, 2063, and the policies of the Government of Nepal. In case of dispute, the courts of Nepal shall have jurisdiction.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">5. Contact</h2>
                  <p>
                    For questions, please contact us. We respect your privacy and handle data in accordance with our <Link to="/privacy" className="text-careplus-primary hover:underline">{t('auth_privacy_policy')}</Link>.
                  </p>
                </section>
              </>
            )}
          </article>

          <p className="mt-8 text-sm text-theme-muted">
            <Link to="/register" className="text-careplus-primary hover:underline">{t('nav_register')}</Link>
            {' · '}
            <Link to="/products" className="text-careplus-primary hover:underline">{t('nav_products')}</Link>
          </p>
        </div>
      </div>
    </WebsiteLayout>
  );
}
