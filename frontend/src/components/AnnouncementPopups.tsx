import { useCallback, useEffect, useState } from 'react';
import { dashboardApi, announcementApi, Announcement } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveImageUrl } from '@/lib/api';
import { X, Gift, Megaphone, Calendar } from 'lucide-react';

/** Renders active announcements as dashboard popups (celebration, banner, modal) with Skip / OK / Skip all. */
export default function AnnouncementPopups() {
  const { t } = useLanguage();
  const [list, setList] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  const current = list[index] ?? null;

  const load = useCallback(() => {
    setLoading(true);
    dashboardApi
      .getActiveAnnouncements()
      .then((data) => {
        setList(Array.isArray(data) ? data : []);
        setIndex(0);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Countdown for auto-dismiss hint (optional: we still require user to click OK/Skip)
  useEffect(() => {
    if (!current?.display_seconds || current.display_seconds < 1) return;
    setCountdown(current.display_seconds);
    const id = setInterval(() => {
      setCountdown((c) => (c != null && c > 1 ? c - 1 : null));
    }, 1000);
    return () => clearInterval(id);
  }, [current?.id, current?.display_seconds]);

  const dismissOne = useCallback(
    (skipAll: boolean) => {
      if (!current) return;
      if (skipAll) {
        announcementApi
          .skipAll()
          .then(() => {
            setList([]);
            setIndex(0);
          })
          .catch(() => {});
        return;
      }
      announcementApi
        .acknowledge(current.id, false)
        .then(() => {
          if (index < list.length - 1) {
            setIndex((i) => i + 1);
            setCountdown(null);
          } else {
            setList([]);
            setIndex(0);
          }
        })
        .catch(() => {});
    },
    [current, index, list.length]
  );

  if (loading || !current) return null;

  const template = current.template || 'celebration';
  const allowSkipAll = current.allow_skip_all !== false;

  const content = (
    <>
      {current.image_url && (
        <div className="mb-4 rounded-xl overflow-hidden bg-theme-bg/50">
          <img
            src={resolveImageUrl(current.image_url)}
            alt=""
            className="w-full h-40 object-cover"
          />
        </div>
      )}
      <h3 className="text-xl font-bold text-theme-text mb-2">{current.title}</h3>
      {current.body && (
        <p className="text-theme-muted text-sm whitespace-pre-wrap mb-4">{current.body}</p>
      )}
      {current.show_terms && current.terms_text && (
        <div className="rounded-xl bg-theme-bg/80 p-3 text-xs text-theme-muted mb-4 max-h-24 overflow-y-auto">
          <span className="font-medium text-theme-text">{t('announcement_popup_terms')}</span>
          <p className="mt-1 whitespace-pre-wrap">{current.terms_text}</p>
        </div>
      )}
      {current.link_url && (
        <a
          href={current.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-careplus-primary text-sm font-medium hover:underline mb-4 inline-block"
        >
          {current.link_url}
        </a>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button
          type="button"
          onClick={() => dismissOne(false)}
          className="px-4 py-2.5 rounded-xl bg-careplus-primary text-theme-text-inverse font-medium hover:opacity-90 transition-opacity"
        >
          {t('announcement_popup_ok')}
        </button>
        <button
          type="button"
          onClick={() => dismissOne(false)}
          className="px-4 py-2.5 rounded-xl border border-theme-border text-theme-text hover:bg-theme-surface-hover transition-colors"
        >
          {t('announcement_popup_skip')}
        </button>
        {allowSkipAll && (
          <button
            type="button"
            onClick={() => dismissOne(true)}
            className="px-4 py-2.5 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition-colors text-sm"
          >
            {t('announcement_popup_skip_all')}
          </button>
        )}
      </div>
      {countdown != null && countdown > 0 && (
        <p className="text-xs text-theme-muted mt-2">
          {countdown}s
        </p>
      )}
    </>
  );

  if (template === 'banner') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-fade-in">
        <div className="max-w-2xl mx-auto rounded-2xl border border-theme-border bg-theme-surface shadow-xl p-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {content}
          </div>
          <button
            type="button"
            onClick={() => dismissOne(false)}
            className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface-hover hover:text-theme-text shrink-0"
            aria-label={t('announcement_popup_skip')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (template === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
        <div
          className="bg-theme-surface rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-theme-border p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-title"
        >
          <div className="flex justify-end -mt-2 -mr-2 mb-2">
            <button
              type="button"
              onClick={() => dismissOne(false)}
              className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface-hover hover:text-theme-text"
              aria-label={t('announcement_popup_skip')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div id="announcement-title">{content}</div>
        </div>
      </div>
    );
  }

  // celebration (default): centered card with gradient and icon
  const typeIcon =
    current.type === 'offer' ? Gift : current.type === 'status' ? Megaphone : Calendar;
  const Icon = typeIcon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div
        className="bg-theme-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-theme-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
      >
        <div className="bg-gradient-to-br from-careplus-primary/20 to-careplus-primary/5 dark:from-careplus-primary/30 dark:to-careplus-primary/10 px-6 pt-6 pb-4">
          <div className="w-14 h-14 rounded-2xl bg-careplus-primary/20 dark:bg-careplus-primary/30 flex items-center justify-center mx-auto mb-3">
            <Icon className="w-7 h-7 text-careplus-primary" />
          </div>
          <p className="text-center text-xs font-medium text-careplus-primary uppercase tracking-wider">
            {current.type === 'offer'
              ? t('announcement_type_offer')
              : current.type === 'status'
                ? t('announcement_type_status')
                : t('announcement_type_event')}
          </p>
        </div>
        <div className="p-6">{content}</div>
      </div>
    </div>
  );
}
