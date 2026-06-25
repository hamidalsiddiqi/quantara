interface TelegramIconProps {
    className?: string;
}

// Telegram glyph — lucide-react does not ship a Telegram icon.
export function TelegramIcon({ className }: TelegramIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M21.94 4.5 18.6 19.27c-.25 1.1-.92 1.37-1.86.86l-5.14-3.79-2.48 2.39c-.27.27-.5.5-1.03.5l.37-5.22 9.49-8.57c.41-.37-.09-.57-.64-.2L5.96 13.07.92 11.5c-1.1-.34-1.12-1.1.23-1.62L20.52 2.9c.91-.34 1.71.21 1.42 1.6z" />
        </svg>
    );
}
