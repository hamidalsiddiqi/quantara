import { Send } from 'lucide-react';

const TELEGRAM_URL = 'https://t.me/Quantalix';

export default function TelegramButton() {
    return (
        <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join us on Telegram"
            title="Join us on Telegram"
            className="group fixed bottom-20 right-4 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/30 ring-1 ring-white/10 transition-all duration-200 hover:scale-110 hover:bg-[#1d8cbf] active:scale-95 lg:bottom-6 lg:right-6"
        >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#229ED9] opacity-20" />
            <Send className="h-6 w-6 -translate-x-px translate-y-px transition-transform group-hover:scale-110" />
        </a>
    );
}
