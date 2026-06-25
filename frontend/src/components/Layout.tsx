import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import {
    LayoutDashboard,
    ArrowDownToLine,
    ArrowUpFromLine,
    RefreshCw,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronRight,
    Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TelegramIcon } from '@/components/TelegramIcon';
import { cn } from '@/lib/utils';

const TELEGRAM_URL = 'https://t.me/Quantalix';

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/deposit', icon: ArrowDownToLine, label: 'Deposit' },
    { to: '/withdraw', icon: ArrowUpFromLine, label: 'Withdraw' },
    { to: '/cycles', icon: RefreshCw, label: 'Cycles' },
    { to: '/referrals', icon: Users, label: 'Referrals' },
];

const adminNavItems = [
    { to: '/user/admin', icon: Shield, label: 'Admin Console' },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    function handleLogout() {
        logout();
        navigate('/login');
    }

    const NavItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => (
        <NavLink
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
                cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                        ? 'bg-primary/15 text-primary border border-primary/20'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
            }
        >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{label}</span>
            <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
        </NavLink>
    );

    const SidebarContent = () => (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex items-center px-3 py-5">
                <img src="/logo.png" alt="Quantalix" className="h-12 w-auto" />
            </div>

            <div className="h-px w-full bg-border mb-3" />

            {/* User info */}
            <div className="px-3 mb-4">
                <div className="rounded-lg bg-secondary/60 p-3">
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-medium truncate">{user?.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
            </div>

            {/* Main nav */}
            <nav className="flex-1 space-y-0.5 px-2">
                {navItems.map((item) => (
                    <NavItem key={item.to} {...item} />
                ))}

                {user?.isAdmin && (
                    <>
                        <div className="pt-4 pb-1 px-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <Shield className="h-3 w-3" />
                                Admin
                            </div>
                        </div>
                        {adminNavItems.map((item) => (
                            <NavItem key={item.to} {...item} />
                        ))}
                    </>
                )}
            </nav>

            {/* Telegram */}
            <div className="px-3 pt-3">
                <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
                >
                    <TelegramIcon className="h-4 w-4 flex-shrink-0" />
                    <span>Telegram</span>
                </a>
            </div>

            {/* Logout */}
            <div className="p-3">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4" />
                    Sign out
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-background text-foreground antialiased">
            {/* Desktop sidebar */}
            <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-border bg-card/40 backdrop-blur-xl">
                <SidebarContent />
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile sidebar (Drawer) */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-[70] w-72 border-r border-border bg-card/95 backdrop-blur-xl transition-all duration-300 ease-in-out lg:hidden',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <div className="flex justify-end p-4">
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <SidebarContent />
            </aside>

            {/* Main content */}
            <div className="flex flex-1 flex-col min-w-0">
                {/* Mobile topbar (Branding only) */}
                <header className="fixed top-0 left-0 right-0 z-50 flex h-12 items-center border-b border-border bg-background/70 backdrop-blur-md px-4 lg:hidden">
                    <span className="text-sm font-bold tracking-widest text-brand-gradient">QUANTARA</span>
                </header>

                <main className="flex-1 overflow-y-auto pt-14 pb-24 lg:pt-0 lg:pb-0 p-4 md:p-6 lg:p-10 animate-fade-in">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>

                {/* Mobile Bottom Bar */}
                <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card/80 backdrop-blur-xl px-2 lg:hidden">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex flex-col items-center justify-center gap-1.5 px-3 py-1 rounded-xl transition-all duration-200",
                                    isActive
                                        ? "text-primary bg-primary/10 shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )
                            }
                        >
                            <item.icon className={cn("h-5 w-5 transition-transform", "active:scale-95")} />
                            <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
                        </NavLink>
                    ))}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="flex flex-col items-center justify-center gap-1.5 px-3 py-1 text-muted-foreground hover:text-foreground transition-all"
                    >
                        <Menu className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">More</span>
                    </button>
                </nav>
            </div>
        </div>
    );
}
