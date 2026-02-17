
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet, Gamepad2, Store, User } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

export default function BottomTabNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const tabs = [
    { href: '/consumer', icon: Home, label: t('common.home') },
    { href: '/consumer/wallet', icon: Wallet, label: t('common.wallet') },
    { href: '/consumer/game', icon: Gamepad2, label: t('common.game') || '게임' },
    { href: '/consumer/stores', icon: Store, label: t('common.stores') },
    { href: '/consumer/profile', icon: User, label: t('common.profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 bottom-nav safe-area-bottom">
      <div className="container mx-auto flex items-center justify-around px-1 sm:px-2 py-1 sm:py-1.5 md:py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href || (tab.href !== '/consumer' && pathname?.startsWith(tab.href));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1 sm:py-1.5 md:py-2 rounded-md sm:rounded-lg transition-colors touch-manipulation ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
              }`}
            >
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
              <span className="text-sm sm:text-base font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
