import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import WebsiteLayout from '@/components/WebsiteLayout';

export default function PrivacyPolicyPage() {
  const { t, locale } = useLanguage();
  const isNe = locale === 'ne';

  return (
    <WebsiteLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-theme-bg-elevated rounded-xl shadow border border-theme-border p-8">
          <h1 className="text-2xl font-bold text-theme-text mb-2">
            {t('privacy_title')}
          </h1>
          <p className="text-sm text-theme-muted mb-6">
            {isNe
              ? 'नेपालको गोप्यता ऐन, २०७५ (२०१८) अनुसार।'
              : 'In accordance with the Privacy Act, 2075 (2018) of Nepal.'}
          </p>

          <article className="prose prose-theme max-w-none text-theme-text space-y-6">
            {isNe ? (
              <>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">१. व्यक्तिगत जानकारी</h2>
                  <p>
                    नेपालको गोप्यता ऐन, २०७५ (२०१८) अनुसार व्यक्तिगत जानकारी भन्नाले नाम, ठेगाना, इमेल, फोन नम्बर, शैक्षिक योग्यता, पहिचान सम्बन्धी जानकारी र सेवा प्रयोग सम्बन्धी डाटा लगायतका जानकारी समावेश गर्दछ। हामी तपाईंको सहमतिमा मात्र यस्तो जानकारी सङ्कलन, भण्डारण र प्रशोधन गर्छौं।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">२. सङ्कलन र प्रयोग</h2>
                  <p>
                    हामी दर्ता र लगइन समय इमेल, नाम, फार्मेसी सम्बन्धी र अन्य आवश्यक जानकारी सङ्कलन गर्छौं। यो जानकारी खाता व्यवस्थापन, अर्डर पूर्ति र सेवा सुधारको लागि प्रयोग गरिन्छ। कानून अनुसार अधिकारीहरूद्वारा अनुमति भएमा मात्र व्यक्तिगत जानकारी सार्वजनिक वा तीस्रो पक्षलाई दिइन्छ।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">३. सहमति</h2>
                  <p>
                    गोप्यता ऐन २०७५ अनुसार सम्बन्धित व्यक्तिको सहमति बिना व्यक्तिगत जानकारी सङ्कलन गर्न मन्निएको छैन। दर्ता गर्दा तपाईंले हाम्रो नियम तथा शर्त र यो गोप्यता नीतिसँग सहमति जनाउनुहुन्छ।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">४. सुरक्षा र भण्डारण</h2>
                  <p>
                    हामी तपाईंको डाटा उचित तानिकी उपायहरूद्वारा सुरक्षित राख्छौं। व्यक्तिगत जानकारी कानून वा नियमले अनुमति दिएअनुसार मात्र राखिन्छ र प्रशोधन गरिन्छ।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">५. तपाईंको अधिकार</h2>
                  <p>
                    तपाईंलाई आफ्नो व्यक्तिगत जानकारी पहुँच, सच्याउन र उचित अवस्थामा मेट्ने अधिकार छ। प्रश्न वा अनुरोधको लागि हामीलाई सम्पर्क गर्नुहोस्।
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">६. सम्पर्क</h2>
                  <p>
                    गोप्यता सम्बन्धी कुनै पनि प्रश्नको लागि हामीलाई सम्पर्क गर्नुहोस्। हामी नेपाल सरकारको गोप्यता ऐन, २०७५ को पालना गर्छौं।
                  </p>
                </section>
              </>
            ) : (
              <>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">1. Personal Information</h2>
                  <p>
                    Under Nepal&apos;s Privacy Act, 2075 (2018), personal information includes name, address, email, phone number, educational qualifications, identity-related information, and data related to your use of our service. We collect, store, and process such information only with your consent.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">2. Collection and Use</h2>
                  <p>
                    We collect email, name, pharmacy-related information, and other necessary details at registration and login. This information is used for account management, order fulfillment, and service improvement. Personal information is disclosed to third parties or made public only when permitted by law or authorized officials.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">3. Consent</h2>
                  <p>
                    Under the Privacy Act 2075, personal information may not be collected without the consent of the concerned person. By registering, you indicate your agreement to our Terms and Conditions and this Privacy Policy.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">4. Security and Storage</h2>
                  <p>
                    We keep your data secure through appropriate technical measures. Personal information is retained and processed only as permitted by applicable law or regulations.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">5. Your Rights</h2>
                  <p>
                    You have the right to access, correct, and in appropriate circumstances request deletion of your personal information. Contact us for any questions or requests.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold mt-4 mb-2">6. Contact</h2>
                  <p>
                    For any privacy-related questions, please contact us. We comply with the Government of Nepal&apos;s Privacy Act, 2075 (2018).
                  </p>
                </section>
              </>
            )}
          </article>

          <p className="mt-8 text-sm text-theme-muted">
            <Link to="/terms" className="text-careplus-primary hover:underline">{t('auth_terms_and_conditions')}</Link>
            {' · '}
            <Link to="/register" className="text-careplus-primary hover:underline">{t('nav_register')}</Link>
            {' · '}
            <Link to="/products" className="text-careplus-primary hover:underline">{t('nav_products')}</Link>
          </p>
        </div>
      </div>
    </WebsiteLayout>
  );
}
