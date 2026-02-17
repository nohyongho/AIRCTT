
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Wallet, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/contexts/I18nContext';
import LanguageToggle from './LanguageToggle';

interface ConsumerHeaderProps {
  showBack?: boolean;
  showWallet?: boolean;
  title?: string;
}

export default function ConsumerHeader({ showBack = true, showWallet = true, title }: ConsumerHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  const isHomePage = pathname === '/consumer';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
      <div className="container mx-auto flex h-11 sm:h-12 md:h-14 items-center justify-between px-2 sm:px-3 md:px-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {showBack && !isHomePage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 touch-manipulation"
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
            </Button>
          )}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isHomePage && (
              <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-md sm:rounded-lg bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg md:text-xl leading-none bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                {title || t('home.title')}
              </span>
              {isHomePage && (
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {t('home.subtitle')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
          <LanguageToggle />
          {showWallet && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/consumer/wallet')}
              className="h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 touch-manipulation"
            >
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
