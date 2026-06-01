import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield } from 'lucide-react';
import AdminUsers from './AdminUsers';
import AdminWithdrawals from './AdminWithdrawals';
import AdminSettings from './AdminSettings';

export default function AdminDashboard() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 border-b border-border/50 pb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-600/30">
                    <Shield className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
                    <p className="text-sm text-muted-foreground mt-1">Centralized platform management, oversight, and configuration</p>
                </div>
            </div>

            <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full lg:w-[600px] grid-cols-3 mb-6 bg-card border border-border/50 shadow-sm p-1.5 h-[52px] rounded-xl">
                    <TabsTrigger value="users" className="text-sm h-full data-[state=active]:bg-blue-600/15 data-[state=active]:text-cyan-400 font-medium rounded-lg transition-all">Users</TabsTrigger>
                    <TabsTrigger value="withdrawals" className="text-sm h-full data-[state=active]:bg-blue-600/15 data-[state=active]:text-cyan-400 font-medium rounded-lg transition-all">Withdrawals</TabsTrigger>
                    <TabsTrigger value="settings" className="text-sm h-full data-[state=active]:bg-blue-600/15 data-[state=active]:text-cyan-400 font-medium rounded-lg transition-all">Settings</TabsTrigger>
                </TabsList>
                <TabsContent value="users" className="mt-0 outline-none">
                    <AdminUsers />
                </TabsContent>
                <TabsContent value="withdrawals" className="mt-0 outline-none">
                    <AdminWithdrawals />
                </TabsContent>
                <TabsContent value="settings" className="mt-0 outline-none">
                    <AdminSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}
