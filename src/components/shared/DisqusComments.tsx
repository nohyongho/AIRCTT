'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface DisqusCommentsProps {
    title?: string;
}

export default function DisqusComments({ title }: DisqusCommentsProps) {
    const pathname = usePathname();
    const disqusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
        if (typeof window === 'undefined') return;

                const SHORTNAME = 'airctt';
        const pageUrl = window.location.href;
        const pageId = pathname;

                if ((window as any).DISQUS) {
                        (window as any).DISQUS.reset({
                                  reload: true,
                                  config: function () {
                                              this.page.url = pageUrl;
                                              this.page.identifier = pageId;
                                              this.page.title = title || document.title;
                                  },
                        });
                } else {
                        (window as any).disqus_config = function () {
                                  this.page.url = pageUrl;
                                  this.page.identifier = pageId;
                                  this.page.title = title || document.title;
                        };
                        const script = document.createElement('script');
                        script.src = `https://${SHORTNAME}.disqus.com/embed.js`;
                        script.setAttribute('data-timestamp', String(Date.now()));
                        script.async = true;
                        (document.head || document.body).appendChild(script);
                }
  }, [pathname, title]);

  return (
        <section className="max-w-3xl mx-auto py-10 px-4">
              <h3 className="text-xl font-bold mb-4">댓글</h3>h3>
              <div id="disqus_thread" ref={disqusRef} />
              <noscript>
                      댓글을 보려면 JavaScript를 활성화해 주세요.
              </noscript>noscript>
        </section>section>
      );
}</section>
